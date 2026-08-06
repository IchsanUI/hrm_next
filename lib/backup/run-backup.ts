import { spawn } from "child_process"
import { createWriteStream, existsSync } from "fs"
import { mkdir, stat, unlink } from "fs/promises"
import path from "path"
import readline from "readline"

import type { BackupScope } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity-log"
import { getBackupScopeTables } from "@/lib/backup/table-groups"

// File backup TIDAK PERNAH ditaruh di public/ (beda dari lib/file-upload.ts)
// — dump database berisi seluruh data sensitif, cuma boleh diambil lewat
// app/api/backup/[publicId]/download/route.ts yang re-cek SUPER_ADMIN.
const BACKUP_DIR = path.join(process.cwd(), "storage", "backups")

function parseDatabaseUrl(url: string) {
  const u = new URL(url)
  return {
    host: u.hostname,
    port: u.port || "3306",
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, ""),
  }
}

async function markFailed(backupId: number, publicId: string, message: string) {
  await prisma.backup
    .update({
      where: { id: backupId },
      data: { status: "FAILED", errorMessage: message, finishedAt: new Date() },
    })
    .catch(() => {})
  await logActivity({
    userId: null,
    username: "system",
    action: "UPDATE",
    entityType: "Backup",
    description: `Backup (${publicId}) gagal: ${message}`,
  })
}

type Conn = ReturnType<typeof parseDatabaseUrl>

// Dump SATU tabel, stdout-nya di-pipe ke writeStream yang sama TANPA
// menutupnya ({ end: false }) supaya tabel berikutnya bisa nyambung ke file
// yang sama. Resolve setelah proses beneran selesai (event "close", bukan
// "exit" — memastikan semua data sudah kepush ke writeStream).
function dumpOneTable(
  mysqldumpPath: string,
  conn: Conn,
  table: string,
  writeStream: NodeJS.WritableStream
): Promise<{ ok: true } | { ok: false; message: string }> {
  return new Promise((resolve) => {
    let child: ReturnType<typeof spawn>
    try {
      child = spawn(
        mysqldumpPath,
        [
          "--single-transaction",
          "--no-tablespaces",
          `--host=${conn.host}`,
          `--port=${conn.port}`,
          `--user=${conn.user}`,
          conn.database,
          "--tables",
          table,
        ],
        { windowsHide: true, env: { ...process.env, MYSQL_PWD: conn.password } }
      )
    } catch (err) {
      resolve({ ok: false, message: err instanceof Error ? err.message : String(err) })
      return
    }

    child.stdout?.pipe(writeStream, { end: false })

    const stderrTail: string[] = []
    if (child.stderr) {
      const rl = readline.createInterface({ input: child.stderr })
      rl.on("line", (line) => {
        stderrTail.push(line)
        if (stderrTail.length > 10) stderrTail.shift()
      })
    }

    child.on("error", (err) => resolve({ ok: false, message: err.message }))
    child.on("close", (code) => {
      if (code !== 0) {
        resolve({ ok: false, message: `tabel "${table}": kode ${code} — ${stderrTail.join(" | ")}` })
        return
      }
      resolve({ ok: true })
    })
  })
}

// Dipanggil TANPA di-await dari server action (lihat
// server/actions/backup.ts createBackupAction) — inilah yang bikin trigger-nya
// non-blocking. Aman dijalankan detached karena app ini jalan sebagai proses
// Node yang long-lived (bukan serverless), sama seperti pola scheduler di
// lib/attendance/auto-sync-scheduler.ts.
//
// Dump dijalankan TABEL PER TABEL (bukan satu proses mysqldump besar) —
// bukan cuma buat progress bar, tapi karena baris "-- Dumping data for
// table" itu ternyata ditulis mysqldump ke FILE DUMP-nya sendiri (stdout),
// BUKAN ke output diagnostik --verbose (stderr) seperti dikira sebelumnya —
// jadi tidak ada cara aman menebak progres dari satu proses tunggal tanpa
// ikut mem-parsing isi dump. Konsekuensinya: konsistensi snapshot per-tabel
// (bukan satu transaksi tunggal utuh lintas-tabel) — trade-off yang wajar
// buat backup manual HRIS, bukan sistem transaksional intensif.
export async function runBackupJob(backupId: number, scope: BackupScope): Promise<void> {
  const backup = await prisma.backup.findUnique({ where: { id: backupId } })
  if (!backup) return

  const settings = await prisma.backupSettings.findUnique({ where: { id: 1 } })
  const mysqldumpPath = settings?.mysqldumpPath?.trim()

  if (!mysqldumpPath) {
    await markFailed(
      backupId,
      backup.publicId,
      "mysqldump.exe belum dikonfigurasi. Atur lokasinya di Pengaturan Backup."
    )
    return
  }
  if (!existsSync(mysqldumpPath)) {
    await markFailed(backupId, backup.publicId, `File mysqldump tidak ditemukan di path: ${mysqldumpPath}`)
    return
  }

  const dbUrl = process.env.DATABASE_URL
  if (!dbUrl) {
    await markFailed(backupId, backup.publicId, "DATABASE_URL tidak dikonfigurasi di server.")
    return
  }
  const conn = parseDatabaseUrl(dbUrl)

  try {
    await mkdir(BACKUP_DIR, { recursive: true })
  } catch (err) {
    await markFailed(
      backupId,
      backup.publicId,
      `Gagal menyiapkan folder backup: ${err instanceof Error ? err.message : String(err)}`
    )
    return
  }

  let tables = getBackupScopeTables(scope)
  if (!tables) {
    // Scope ALL — ambil daftar tabel sungguhan dari information_schema
    // (bukan hardcode) supaya tetap dump tabel baru yang belum sempat
    // dikelompokkan ke lib/backup/table-groups.ts.
    // WAJIB dialiaskan eksplisit — tanpa alias, MySQL mengembalikan nama
    // kolom apa adanya dari information_schema (TABLE_NAME, huruf besar),
    // bukan table_name, jadi r.table_name selalu undefined kalau tidak di-alias.
    const rows = await prisma.$queryRaw<{ table_name: string }[]>`
      SELECT TABLE_NAME AS table_name FROM information_schema.tables WHERE table_schema = DATABASE()
    `
    tables = rows.map((r) => r.table_name)
  }

  if (tables.length === 0) {
    await markFailed(backupId, backup.publicId, "Tidak ada tabel untuk cakupan ini.")
    return
  }

  const fileName = `backup_${scope.toLowerCase()}_${backup.publicId}.sql`
  const filePath = path.join(BACKUP_DIR, fileName)
  const out = createWriteStream(filePath)

  let tablesDone = 0
  for (const table of tables) {
    const result = await dumpOneTable(mysqldumpPath, conn, table, out)
    if (!result.ok) {
      out.end()
      await unlink(filePath).catch(() => {})
      await markFailed(backupId, backup.publicId, `Gagal dump ${result.message}`)
      return
    }
    tablesDone++
    await prisma.backup.update({ where: { id: backupId }, data: { tablesDone } }).catch(() => {})
  }

  await new Promise<void>((resolve) => out.end(resolve))

  try {
    const info = await stat(filePath)
    await prisma.backup.update({
      where: { id: backupId },
      data: {
        status: "SUCCESS",
        finishedAt: new Date(),
        fileName,
        filePath,
        fileSizeBytes: info.size,
        tablesDone,
        tablesTotal: tables.length,
      },
    })
    await logActivity({
      userId: backup.triggeredByUserId,
      username: backup.triggeredByUsername,
      action: "CREATE",
      entityType: "Backup",
      description: `Backup (${backup.publicId}) selesai — cakupan ${scope}, ukuran ${(info.size / 1024 / 1024).toFixed(2)} MB.`,
    })
  } catch (err) {
    await markFailed(
      backupId,
      backup.publicId,
      `Gagal finalisasi backup: ${err instanceof Error ? err.message : String(err)}`
    )
  }
}
