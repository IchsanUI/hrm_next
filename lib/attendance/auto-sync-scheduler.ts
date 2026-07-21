import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity-log"
import { syncAllDevices } from "@/lib/attendance/sync"

// Loop otomatis "Ambil Data Mesin" berkala — pengganti attendsync_service.py
// yang dulu jalan sebagai proses Python terpisah. Dijalankan sekali lewat
// instrumentation.ts saat server Next.js start (bukan per-request), pakai
// setTimeout yang menjadwalkan ulang dirinya sendiri (bukan setInterval)
// supaya interval-nya bisa dibaca ulang tiap siklus dari
// AttendanceSettings.pollSeconds — admin ganti angkanya di Pengaturan
// Absensi, langsung berlaku di siklus berikutnya tanpa restart server.
const DEFAULT_POLL_SECONDS = 30
// Samakan dengan validasi minimal di updateAttendancePollSecondsAction
// (server/actions/attendance.ts) — satu sumber angka batas bawah.
const MIN_POLL_SECONDS = 5

// Guard pakai globalThis (bukan variabel modul biasa) supaya tetap cuma
// satu loop yang jalan walau module ini di-reload beberapa kali oleh
// Turbopack/webpack HMR selama development.
declare global {
  var __attendanceAutoSyncStarted: boolean | undefined
}

let isRunning = false

async function runCycle() {
  if (isRunning) return // siklus sebelumnya belum selesai, lewati giliran ini
  isRunning = true
  try {
    const results = await syncAllDevices()
    const totalSaved = results.reduce((sum, r) => sum + r.saved, 0)
    const failed = results.filter((r) => r.error)

    // Cuma dicatat ke Log Aktivitas kalau ada perubahan nyata (record baru
    // atau ada mesin yang gagal) — supaya log tidak banjir entri "0 record
    // baru" tiap 30 detik sepanjang hari.
    if (totalSaved > 0 || failed.length > 0) {
      const parts = [`${totalSaved} record baru dari ${results.length} mesin`]
      if (failed.length > 0) {
        parts.push(
          `${failed.length} mesin gagal (${failed.map((f) => `${f.deviceName}: ${f.error}`).join("; ")})`
        )
      }
      await logActivity({
        userId: null,
        username: "system",
        action: "DOWNLOAD",
        entityType: "AttendanceLog",
        description: `Auto-sync absensi berkala — ${parts.join(", ")}.`,
      })
    }
  } catch (e) {
    await logActivity({
      userId: null,
      username: "system",
      action: "DOWNLOAD",
      entityType: "AttendanceLog",
      description: `Auto-sync absensi gagal: ${e instanceof Error ? e.message : String(e)}`,
    })
  } finally {
    isRunning = false
  }
}

async function scheduleNext() {
  let pollSeconds = DEFAULT_POLL_SECONDS
  try {
    const settings = await prisma.attendanceSettings.findUnique({ where: { id: 1 } })
    if (settings) pollSeconds = settings.pollSeconds
  } catch {
    // gagal baca setting (mis. migrasi belum jalan) — pakai default
  }

  setTimeout(() => {
    void runCycle().finally(() => {
      void scheduleNext()
    })
  }, Math.max(MIN_POLL_SECONDS, pollSeconds) * 1000)
}

export function startAttendanceAutoSync() {
  if (globalThis.__attendanceAutoSyncStarted) return
  globalThis.__attendanceAutoSyncStarted = true
  void scheduleNext()
}
