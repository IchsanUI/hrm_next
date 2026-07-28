// Skema NIP otomatis (disepakati user, lihat riwayat chat):
// [huruf status][2 digit tahun masuk][6 digit tgl+bulan+tahun lahir][3 digit urutan pegawai]
// - Huruf status: Kontrak=K, Percobaan=T, Magang=M, Tetap/lainnya=tanpa huruf.
// - Tahun masuk: 2 digit terakhir tahun Mulai Kerja.
// - Tgl+bulan+tahun lahir: DDMMYY (tanggal-bulan-tahun, konvensi Indonesia).
// - Urutan pegawai: urutan ke berapa secara KESELURUHAN (dihitung dari total
//   semua baris Employee yang PERNAH dibuat, termasuk yang sudah
//   di-soft-delete — supaya nomor urut tidak pernah dipakai ulang meski ada
//   pegawai yang dihapus), 3 digit, mulai dari 001.
const STATUS_PREFIX: Record<string, string> = {
  kontrak: "K",
  percobaan: "T",
  magang: "M",
}

export function employeeNumberPrefixFor(employmentStatusName: string): string {
  return STATUS_PREFIX[employmentStatusName.trim().toLowerCase()] ?? ""
}

export function buildEmployeeNumber({
  employmentStatusName,
  startDate,
  birthDate,
  sequence,
}: {
  employmentStatusName: string
  startDate: Date
  birthDate: Date
  sequence: number
}): string {
  const prefix = employeeNumberPrefixFor(employmentStatusName)
  const yearIn = String(startDate.getFullYear()).slice(-2)
  const day = String(birthDate.getDate()).padStart(2, "0")
  const month = String(birthDate.getMonth() + 1).padStart(2, "0")
  const yearBorn = String(birthDate.getFullYear()).slice(-2)
  const seq = String(sequence).padStart(3, "0")
  return `${prefix}${yearIn}${day}${month}${yearBorn}${seq}`
}
