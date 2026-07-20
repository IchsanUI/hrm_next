// Batas konfirmasi mandiri pegawai: jam 11:00 di HARI YANG SAMA dengan
// createdAt pengajuan (Izin Terlambat diajukan real-time saat masih
// perjalanan, jadi createdAt = hari kejadian). Lewat jam itu, cuma Super
// Admin yang bisa konfirmasi manual (lewat Monitoring Izin) — mencegah
// pegawai konfirmasi telat/asal sebelum sempat dikoreksi HR, yang bikin
// data historis kadung ada tapi salah (ambigu).
export function canSelfConfirmArrival(createdAt: Date, now: Date = new Date()): boolean {
  const cutoff = new Date(createdAt)
  cutoff.setHours(11, 0, 0, 0)
  return now.getTime() <= cutoff.getTime()
}
