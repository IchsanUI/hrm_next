import { createHash, randomBytes } from "crypto"
import { mkdir, readFile, unlink, writeFile } from "fs/promises"
import path from "path"
import { gunzipSync, gzipSync } from "zlib"
import { Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import { ARCHIVE_TARGET_INFO, isArchiveTarget, type ArchiveTarget } from "@/lib/archive/targets"

// Format file arsip: gzip berisi JSON Lines. Baris pertama header, sisanya
// satu baris data per baris teks (nilai DateTime ditulis ISO string).
const FORMAT = "hrm-next-archive"
const FORMAT_VERSION = 1
const ARCHIVE_DIR = path.join(process.cwd(), "storage", "archives")
// Batas baris per proses arsip — yang paling lama duluan; sisanya bisa
// diarsipkan di proses berikutnya. Menjaga memori & durasi request.
export const MAX_ROWS_PER_ARCHIVE = 200_000
const CHUNK = 1000

type Header = {
  format: typeof FORMAT
  version: number
  target: ArchiveTarget
  model: string
  cutoff: string
  createdAt: string
  rowCount: number
}

type Row = Record<string, unknown> & { id: number }

const MODEL_NAME: Record<ArchiveTarget, Prisma.ModelName> = {
  attendance_logs: "AttendanceLog",
  activity_logs: "ActivityLog",
  notifications: "Notification",
}

export function cutoffFromMonths(months: number, now = new Date()) {
  const cutoff = new Date(now)
  cutoff.setMonth(cutoff.getMonth() - months)
  return cutoff
}

function whereOld(target: ArchiveTarget, cutoff: Date) {
  switch (target) {
    case "attendance_logs":
      return { logTime: { lt: cutoff } }
    case "activity_logs":
      return { createdAt: { lt: cutoff } }
    case "notifications":
      return { createdAt: { lt: cutoff }, isRead: true }
  }
}

export async function countArchivable(target: ArchiveTarget, cutoff: Date): Promise<number> {
  switch (target) {
    case "attendance_logs":
      return prisma.attendanceLog.count({ where: whereOld(target, cutoff) })
    case "activity_logs":
      return prisma.activityLog.count({ where: whereOld(target, cutoff) })
    case "notifications":
      return prisma.notification.count({ where: whereOld(target, cutoff) })
  }
}

async function fetchOldRows(target: ArchiveTarget, cutoff: Date): Promise<Row[]> {
  const args = { where: whereOld(target, cutoff), orderBy: { id: "asc" as const }, take: MAX_ROWS_PER_ARCHIVE }
  switch (target) {
    case "attendance_logs":
      return prisma.attendanceLog.findMany(args as Prisma.AttendanceLogFindManyArgs)
    case "activity_logs":
      return prisma.activityLog.findMany(args as Prisma.ActivityLogFindManyArgs)
    case "notifications":
      return prisma.notification.findMany(args as Prisma.NotificationFindManyArgs)
  }
}

// Tipe diambil dari client project (yang memakai $extends), bukan Prisma.TransactionClient.
type LogDelegates = Pick<typeof prisma, "attendanceLog" | "activityLog" | "notification">

function deleteByIds(tx: LogDelegates, target: ArchiveTarget, ids: number[]) {
  const where = { id: { in: ids } }
  switch (target) {
    case "attendance_logs":
      return tx.attendanceLog.deleteMany({ where })
    case "activity_logs":
      return tx.activityLog.deleteMany({ where })
    case "notifications":
      return tx.notification.deleteMany({ where })
  }
}

function encode(header: Header, rows: Row[]): Buffer {
  const lines = [JSON.stringify(header), ...rows.map((r) => JSON.stringify(r))]
  return gzipSync(Buffer.from(lines.join("\n") + "\n", "utf8"))
}

function decode(buffer: Buffer): { header: Header; rows: Row[] } {
  let text: string
  try {
    text = gunzipSync(buffer).toString("utf8")
  } catch {
    throw new Error("File bukan arsip yang valid (gagal dibuka sebagai gzip).")
  }
  const lines = text.split("\n").filter((l) => l.trim().length > 0)
  const header = JSON.parse(lines[0] ?? "{}") as Partial<Header>
  if (header.format !== FORMAT || header.version !== FORMAT_VERSION || !isArchiveTarget(header.target)) {
    throw new Error("File bukan arsip HRIS yang dikenali.")
  }
  const rows = lines.slice(1).map((l) => JSON.parse(l) as Row)
  if (rows.length !== header.rowCount) {
    throw new Error(`Arsip tidak utuh: header ${header.rowCount} baris, isi ${rows.length} baris.`)
  }
  return { header: header as Header, rows }
}

export type ArchiveRunResult = {
  publicId: string
  rowCount: number
  fileSizeBytes: number
  remaining: number
}

// Urutan aman: ekspor → tulis file → BACA ULANG & verifikasi isi file →
// baru hapus baris (berdasarkan id yang benar-benar ada di file, bukan
// query tanggal ulang) dalam satu transaksi bersama pencatatan arsip.
export async function runArchive(
  target: ArchiveTarget,
  months: number,
  username: string
): Promise<ArchiveRunResult> {
  const cutoff = cutoffFromMonths(months)
  const rows = await fetchOldRows(target, cutoff)
  if (rows.length === 0) {
    throw new Error("Tidak ada data yang lebih lama dari batas tanggal ini.")
  }

  const now = new Date()
  const header: Header = {
    format: FORMAT,
    version: FORMAT_VERSION,
    target,
    model: MODEL_NAME[target],
    cutoff: cutoff.toISOString(),
    createdAt: now.toISOString(),
    rowCount: rows.length,
  }
  const buffer = encode(header, rows)

  await mkdir(ARCHIVE_DIR, { recursive: true })
  const stamp = now.toISOString().slice(0, 10).replaceAll("-", "")
  const fileName = `arsip_${target}_${stamp}_${randomBytes(4).toString("hex")}.jsonl.gz`
  const filePath = path.join(ARCHIVE_DIR, fileName)
  await writeFile(filePath, buffer)

  // Verifikasi dari disk — kalau gagal, file dibuang dan TIDAK ada yang dihapus.
  try {
    const written = decode(await readFile(filePath))
    const expectedIds = new Set(rows.map((r) => r.id))
    if (written.rows.length !== rows.length || !written.rows.every((r) => expectedIds.has(r.id))) {
      throw new Error("Isi file arsip tidak cocok dengan data yang diekspor.")
    }
  } catch (err) {
    await unlink(filePath).catch(() => {})
    throw err
  }

  const sha256 = createHash("sha256").update(buffer).digest("hex")
  const ids = rows.map((r) => r.id)
  const chunks: number[][] = []
  for (let i = 0; i < ids.length; i += CHUNK) chunks.push(ids.slice(i, i + CHUNK))

  let archive
  try {
    archive = await prisma.$transaction(
      async (tx) => {
        const created = await tx.dataArchive.create({
          data: {
            target,
            cutoff,
            rowCount: rows.length,
            fileName,
            filePath,
            fileSizeBytes: buffer.length,
            sha256,
            createdByUsername: username,
          },
        })
        let deleted = 0
        for (const chunk of chunks) deleted += (await deleteByIds(tx, target, chunk)).count
        // Jumlah terhapus wajib sama dengan isi arsip — kalau tidak (mis.
        // ada baris yang berubah di tengah proses), batalkan semuanya.
        if (deleted !== rows.length) {
          throw new Error(`Jumlah baris terhapus (${deleted}) tidak sama dengan isi arsip (${rows.length}). Dibatalkan.`)
        }
        return created
      },
      { timeout: 120_000, maxWait: 10_000 }
    )
  } catch (err) {
    // Transaksi batal → data masih utuh; file arsip tidak diperlukan.
    await unlink(filePath).catch(() => {})
    throw err
  }

  const remaining = await countArchivable(target, cutoff)
  return { publicId: archive.publicId, rowCount: rows.length, fileSizeBytes: buffer.length, remaining }
}

// ---------- Import ulang (mode GABUNG) ----------

function dateFieldsOf(model: string): string[] {
  const m = Prisma.dmmf.datamodel.models.find((x) => x.name === model)
  return m ? m.fields.filter((f) => f.kind === "scalar" && f.type === "DateTime").map((f) => f.name) : []
}

export type RestoreResult = {
  target: ArchiveTarget
  totalRows: number
  inserted: number
  skippedExisting: number
  skippedOrphan: number
  sha256: string
}

export async function restoreArchive(buffer: Buffer): Promise<RestoreResult> {
  const { header, rows } = decode(buffer)
  const target = header.target
  const sha256 = createHash("sha256").update(buffer).digest("hex")

  // DateTime ditulis sebagai ISO string di file — ubah balik ke Date.
  const dateFields = dateFieldsOf(MODEL_NAME[target])
  const data = rows.map((r) => {
    const copy: Record<string, unknown> = { ...r }
    for (const f of dateFields) {
      if (typeof copy[f] === "string") copy[f] = new Date(copy[f] as string)
    }
    return copy
  })

  // Relasi ke users: baris notifikasi milik user yang sudah dihapus tidak
  // bisa dimasukkan (FK wajib) → dilewati; log aktivitas cukup userId-nya
  // dikosongkan (username snapshot tetap ada).
  let skippedOrphan = 0
  let prepared = data
  if (target === "notifications" || target === "activity_logs") {
    const userIds = [...new Set(data.map((d) => d.userId).filter((v): v is number => typeof v === "number"))]
    const existing = new Set(
      (await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true } })).map((u) => u.id)
    )
    if (target === "notifications") {
      prepared = data.filter((d) => existing.has(d.userId as number))
      skippedOrphan = data.length - prepared.length
    } else {
      prepared = data.map((d) =>
        typeof d.userId === "number" && !existing.has(d.userId) ? { ...d, userId: null } : d
      )
    }
  }

  let inserted = 0
  for (let i = 0; i < prepared.length; i += CHUNK) {
    const chunk = prepared.slice(i, i + CHUNK)
    const result =
      target === "attendance_logs"
        ? await prisma.attendanceLog.createMany({ data: chunk as Prisma.AttendanceLogCreateManyInput[], skipDuplicates: true })
        : target === "activity_logs"
          ? await prisma.activityLog.createMany({ data: chunk as Prisma.ActivityLogCreateManyInput[], skipDuplicates: true })
          : await prisma.notification.createMany({ data: chunk as Prisma.NotificationCreateManyInput[], skipDuplicates: true })
    inserted += result.count
  }

  return {
    target,
    totalRows: rows.length,
    inserted,
    skippedExisting: prepared.length - inserted,
    skippedOrphan,
    sha256,
  }
}

export function describeTarget(target: string) {
  return isArchiveTarget(target) ? ARCHIVE_TARGET_INFO[target].label : target
}
