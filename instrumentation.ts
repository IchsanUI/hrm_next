// Dipanggil SEKALI oleh Next.js saat instance server baru mulai (dev
// maupun production) — dipakai buat menyalakan loop auto-sync absensi
// (lihat lib/attendance/auto-sync-scheduler.ts), pengganti proses Python
// terpisah (attendsync_service.py) yang dulu harus dijalankan manual.
export async function register() {
  // Dinyalakan lagi atas permintaan — sebelumnya sempat dimatikan karena 3
  // mesin (Pusat, Menganti, Bungah) tidak bisa dijangkau. Interval pollingnya
  // diatur admin lewat Pengaturan Absensi (AttendanceSettings.pollSeconds,
  // minimal 5 detik) — bukan di-hardcode di sini. Kalau ternyata jaringan ke
  // mesin masih bermasalah, komentari lagi blok di bawah ini.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startAttendanceAutoSync } = await import("@/lib/attendance/auto-sync-scheduler")
    startAttendanceAutoSync()

    // Pembersihan backup lama sesuai retensi (lihat lib/backup/retention-scheduler.ts,
    // BackupSettings.retentionDays diatur admin lewat Backup Manual).
    const { startBackupRetentionCleanup } = await import("@/lib/backup/retention-scheduler")
    startBackupRetentionCleanup()
  }
}
