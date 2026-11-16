import { readdir, stat, statfs } from "fs/promises"
import path from "path"
import type { BackupScope } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import { BACKUP_SCOPE_LABEL, BACKUP_SCOPE_TABLES } from "@/lib/backup/table-groups"

// Data untuk Backup → Monitoring Penyimpanan (khusus SUPER_ADMIN).

type ModuleScope = Exclude<BackupScope, "ALL">

export type TableSize = { table: string; bytes: number; rows: number }

export type ModuleSize = {
  scope: ModuleScope | null // null = tabel di luar grup backup mana pun
  label: string
  bytes: number
  rows: number
  tables: TableSize[]
}

function toNumber(value: unknown): number {
  if (typeof value === "bigint") return Number(value)
  if (typeof value === "number") return value
  if (value && typeof value === "object" && "toString" in value) return Number(String(value)) || 0
  if (typeof value === "string") return Number(value) || 0
  return 0
}

export async function getTableSizes(): Promise<TableSize[]> {
  const rows = await prisma.$queryRaw<{ name: string; bytes: unknown; rowCount: unknown }[]>`
    SELECT table_name AS name,
           COALESCE(data_length + index_length, 0) AS bytes,
           COALESCE(table_rows, 0) AS rowCount
    FROM information_schema.tables
    WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE'`
  return rows
    .filter((r) => r.name !== "_prisma_migrations")
    .map((r) => ({ table: r.name, bytes: toNumber(r.bytes), rows: toNumber(r.rowCount) }))
}

// Dikelompokkan memakai definisi grup yang SAMA dengan Backup Manual
// (lib/backup/table-groups.ts) supaya tombol "Backup modul ini" konsisten
// dengan angka yang ditampilkan.
export function groupByModule(tables: TableSize[]): ModuleSize[] {
  const scopeOf = new Map<string, ModuleScope>()
  for (const [scope, names] of Object.entries(BACKUP_SCOPE_TABLES) as [ModuleScope, string[]][]) {
    for (const name of names) scopeOf.set(name, scope)
  }

  const groups = new Map<ModuleScope | null, ModuleSize>()
  for (const t of tables) {
    const scope = scopeOf.get(t.table) ?? null
    const group = groups.get(scope) ?? {
      scope,
      label: scope ? BACKUP_SCOPE_LABEL[scope] : "Lainnya",
      bytes: 0,
      rows: 0,
      tables: [],
    }
    group.bytes += t.bytes
    group.rows += t.rows
    group.tables.push(t)
    groups.set(scope, group)
  }
  for (const g of groups.values()) g.tables.sort((a, b) => b.bytes - a.bytes)
  return [...groups.values()].sort((a, b) => b.bytes - a.bytes)
}

export type FolderSize = { key: string; label: string; path: string; bytes: number; files: number }

async function folderSize(dir: string): Promise<{ bytes: number; files: number }> {
  let bytes = 0
  let files = 0
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return { bytes, files } // folder belum ada
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      const sub = await folderSize(full)
      bytes += sub.bytes
      files += sub.files
    } else if (entry.isFile()) {
      try {
        bytes += (await stat(full)).size
        files++
      } catch {
        // file terkunci/terhapus — lewati
      }
    }
  }
  return { bytes, files }
}

const FOLDERS = [
  { key: "uploads", label: "Upload pegawai & lampiran", path: "public/uploads" },
  { key: "dokumen", label: "Dokumen pegawai", path: "storage/dokumen-pegawai" },
  { key: "perpustakaan", label: "PDF Perpustakaan", path: "storage/perpustakaan" },
  { key: "backups", label: "File backup", path: "storage/backups" },
]

export async function getFolderSizes(): Promise<FolderSize[]> {
  return Promise.all(
    FOLDERS.map(async (f) => ({ ...f, ...(await folderSize(path.join(process.cwd(), f.path))) }))
  )
}

export type DiskUsage = { totalBytes: number; freeBytes: number; usedBytes: number; usedPercent: number } | null

export async function getDiskUsage(): Promise<DiskUsage> {
  try {
    const s = await statfs(process.cwd())
    const totalBytes = s.blocks * s.bsize
    const freeBytes = s.bavail * s.bsize
    const usedBytes = totalBytes - freeBytes
    return { totalBytes, freeBytes, usedBytes, usedPercent: totalBytes > 0 ? (usedBytes / totalBytes) * 100 : 0 }
  } catch {
    return null
  }
}

function todayDate() {
  const now = new Date()
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
}

// Upsert snapshot hari ini — dipanggil scheduler retensi backup (tiap 6 jam)
// dan saat halaman Monitoring Penyimpanan dibuka.
export async function recordStorageSnapshot(input?: { databaseBytes: number; filesBytes: number }) {
  let values = input
  if (!values) {
    const [tables, folders] = await Promise.all([getTableSizes(), getFolderSizes()])
    values = {
      databaseBytes: tables.reduce((sum, t) => sum + t.bytes, 0),
      filesBytes: folders.reduce((sum, f) => sum + f.bytes, 0),
    }
  }
  const date = todayDate()
  await prisma.storageSnapshot.upsert({
    where: { date },
    create: { date, databaseBytes: BigInt(values.databaseBytes), filesBytes: BigInt(values.filesBytes) },
    update: { databaseBytes: BigInt(values.databaseBytes), filesBytes: BigInt(values.filesBytes) },
  })
}

export type SnapshotPoint = { date: string; databaseBytes: number; filesBytes: number }

export async function getSnapshots(days = 30): Promise<SnapshotPoint[]> {
  const since = new Date(todayDate().getTime() - (days - 1) * 86_400_000)
  const rows = await prisma.storageSnapshot.findMany({
    where: { date: { gte: since } },
    orderBy: { date: "asc" },
  })
  return rows.map((r) => ({
    date: r.date.toISOString().slice(0, 10),
    databaseBytes: Number(r.databaseBytes),
    filesBytes: Number(r.filesBytes),
  }))
}

export type ArchiveRecommendation = {
  key: string
  label: string
  description: string
  scope: ModuleScope
  oldRows: number
  cutoff: Date
  lastBackupAt: Date | null
  safe: boolean // sudah ter-backup setelah batas tanggal → baris lama ada di file backup
}

const ARCHIVE_CANDIDATES = [
  {
    key: "attendance_logs",
    label: "Log Absensi (fingerprint)",
    months: 12,
    count: (cutoff: Date) => prisma.attendanceLog.count({ where: { logTime: { lt: cutoff } } }),
  },
  {
    key: "activity_logs",
    label: "Log Aktivitas",
    months: 6,
    count: (cutoff: Date) => prisma.activityLog.count({ where: { createdAt: { lt: cutoff } } }),
  },
  {
    key: "notifications",
    label: "Notifikasi yang sudah dibaca",
    months: 3,
    count: (cutoff: Date) => prisma.notification.count({ where: { createdAt: { lt: cutoff }, isRead: true } }),
  },
] as const

function scopeOfTable(table: string): ModuleScope {
  for (const [scope, names] of Object.entries(BACKUP_SCOPE_TABLES) as [ModuleScope, string[]][]) {
    if (names.includes(table)) return scope
  }
  return "SISTEM"
}

export async function getArchiveRecommendations(now = new Date()): Promise<ArchiveRecommendation[]> {
  return Promise.all(
    ARCHIVE_CANDIDATES.map(async (c) => {
      const cutoff = new Date(now)
      cutoff.setMonth(cutoff.getMonth() - c.months)
      const scope = scopeOfTable(c.key)
      const [oldRows, lastBackup] = await Promise.all([
        c.count(cutoff),
        prisma.backup.findFirst({
          where: { status: "SUCCESS", scope: { in: [scope, "ALL"] } },
          orderBy: { startedAt: "desc" },
          select: { startedAt: true },
        }),
      ])
      return {
        key: c.key,
        label: c.label,
        description: `Lebih lama dari ${c.months} bulan`,
        scope,
        oldRows,
        cutoff,
        lastBackupAt: lastBackup?.startedAt ?? null,
        // Backup yang dimulai SETELAH batas tanggal pasti memuat baris yang lebih tua dari batas itu.
        safe: !!lastBackup && lastBackup.startedAt > cutoff,
      }
    })
  )
}
