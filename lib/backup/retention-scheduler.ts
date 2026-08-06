import { unlink } from "fs/promises"

import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity-log"

// Pembersihan backup lama — pola sama persis dengan
// lib/attendance/auto-sync-scheduler.ts (self-rescheduling setTimeout,
// dijalankan sekali lewat instrumentation.ts, guard globalThis biar tetap
// satu loop walau module di-reload HMR di dev).
const CHECK_INTERVAL_SECONDS = 6 * 60 * 60 // 6 jam — retensi tidak perlu granular
const DEFAULT_RETENTION_DAYS = 30

declare global {
  var __backupRetentionStarted: boolean | undefined
}

let isRunning = false

async function runCycle() {
  if (isRunning) return
  isRunning = true
  try {
    const settings = await prisma.backupSettings.findUnique({ where: { id: 1 } })
    const retentionDays = settings?.retentionDays ?? DEFAULT_RETENTION_DAYS
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000)

    const expired = await prisma.backup.findMany({
      where: { status: "SUCCESS", finishedAt: { lt: cutoff } },
      select: { id: true, publicId: true, filePath: true },
    })

    if (expired.length === 0) return

    for (const backup of expired) {
      if (backup.filePath) {
        await unlink(backup.filePath).catch(() => {})
      }
    }
    await prisma.backup.deleteMany({ where: { id: { in: expired.map((b) => b.id) } } })

    await logActivity({
      userId: null,
      username: "system",
      action: "DELETE",
      entityType: "Backup",
      description: `Retensi backup otomatis — ${expired.length} backup lebih lama dari ${retentionDays} hari dihapus.`,
    })
  } catch (e) {
    await logActivity({
      userId: null,
      username: "system",
      action: "DELETE",
      entityType: "Backup",
      description: `Retensi backup otomatis gagal: ${e instanceof Error ? e.message : String(e)}`,
    })
  } finally {
    isRunning = false
  }
}

function scheduleNext() {
  setTimeout(() => {
    void runCycle().finally(() => scheduleNext())
  }, CHECK_INTERVAL_SECONDS * 1000)
}

export function startBackupRetentionCleanup() {
  if (globalThis.__backupRetentionStarted) return
  globalThis.__backupRetentionStarted = true
  scheduleNext()
}
