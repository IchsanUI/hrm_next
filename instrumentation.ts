// Dipanggil SEKALI oleh Next.js saat instance server baru mulai (dev
// maupun production) — dipakai buat menyalakan loop auto-sync absensi
// (lihat lib/attendance/auto-sync-scheduler.ts), pengganti proses Python
// terpisah (attendsync_service.py) yang dulu harus dijalankan manual.
export async function register() {
  // Auto-sync dimatikan sementara — 3 mesin (Pusat, Menganti, Bungah) tidak
  // bisa dijangkau (fetch failed), loop berkala cuma menghasilkan noise di
  // Log Aktivitas. Sync manual lewat tombol "Ambil Data Mesin" masih jalan.
  // Aktifkan lagi dengan un-comment blok di bawah kalau jaringan ke mesin
  // sudah pulih.
  // if (process.env.NEXT_RUNTIME === "nodejs") {
  //   const { startAttendanceAutoSync } = await import("@/lib/attendance/auto-sync-scheduler")
  //   startAttendanceAutoSync()
  // }
}
