import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity-log"
import { syncAllDevices } from "@/lib/attendance/sync"

// Loop otomatis "Ambil Data Mesin" berkala — pengganti attendsync_service.py
// yang dulu jalan sebagai proses Python terpisah. Dijalankan sekali lewat
// instrumentation.ts saat server Next.js start (bukan per-request), pakai
// setTimeout yang menjadwalkan ulang dirinya sendiri (bukan setInterval)
// supaya interval/mode-nya bisa dibaca ulang tiap siklus dari
// AttendanceSettings — admin ganti pengaturannya di Pengaturan Absensi,
// langsung berlaku di siklus berikutnya tanpa restart server. Dua mode:
// INTERVAL (tiap N detik sepanjang hari, perilaku lama) atau SCHEDULED
// (cuma di jam:menit tertentu — dicek tiap menit, lihat scheduleNext).
const DEFAULT_POLL_SECONDS = 30
// Samakan dengan validasi minimal di updateAttendanceSyncSettingsAction
// (server/actions/attendance.ts) — satu sumber angka batas bawah.
const MIN_POLL_SECONDS = 5
// Granularitas pengecekan mode SCHEDULED — jadwal ditulis per menit
// ("HH:mm"), jadi tiap 60 detik cukup, tidak perlu polling lebih rapat.
const SCHEDULE_CHECK_INTERVAL_SECONDS = 60

const SCHEDULED_TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

// Satu sumber parsing "HH:mm,HH:mm" — dipakai scheduler ini DAN validasi form
// di server action, supaya keduanya selalu sepakat format mana yang valid.
export function parseScheduledTimes(raw: string | null | undefined): string[] {
  if (!raw) return []
  return raw
    .split(",")
    .map((t) => t.trim())
    .filter((t) => SCHEDULED_TIME_PATTERN.test(t))
}

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
    // notify=true — SATU-SATUNYA pemanggil syncAllDevices yang boleh kirim
    // push notification "Absen Berhasil" ke pegawai (lihat catatan di
    // lib/attendance/sync.ts). Tombol "Ambil Data Mesin" manual TIDAK
    // mengirim notifikasi.
    const results = await syncAllDevices(undefined, undefined, true)
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

// Dipakai mode SCHEDULED yang lagi dinonaktifkan sementara (lihat komentar
// di scheduleNext di bawah) — dibiarkan tetap ada (bukan dihapus) supaya
// gampang dipasang lagi nanti:
//
// let lastScheduledRunKey: string | null = null
// function currentHourMinute(now: Date) {
//   return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`
// }

// Mode SCHEDULED ("Jadwal Jam Tertentu") SENGAJA dinonaktifkan sementara
// atas permintaan — fokus dulu ke mode INTERVAL (polling tiap N detik)
// supaya bisa dites di angka serendah mungkin (mis. 5 detik) tanpa
// mikirin mode lain. Kode & UI-nya (components/attendance-settings-form.tsx)
// TIDAK dihapus, cuma dikomentari — gampang dinyalakan lagi nanti kalau
// dibutuhkan.
async function scheduleNext() {
  let enabled = true
  let pollSeconds = DEFAULT_POLL_SECONDS
  try {
    const settings = await prisma.attendanceSettings.findUnique({ where: { id: 1 } })
    if (settings) {
      enabled = settings.enabled
      pollSeconds = settings.pollSeconds
    }
  } catch {
    // gagal baca setting (mis. migrasi belum jalan) — pakai default
  }

  // Saklar mati — jangan jalankan siklus apa pun, tapi tetap cek ulang
  // berkala supaya langsung nyala lagi begitu admin menghidupkan
  // saklarnya, tanpa perlu restart server.
  if (!enabled) {
    setTimeout(() => void scheduleNext(), SCHEDULE_CHECK_INTERVAL_SECONDS * 1000)
    return
  }

  // if (syncMode === "SCHEDULED") { ... } — lihat komentar di atas fungsi ini.

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
