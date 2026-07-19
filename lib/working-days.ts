// Murni tanggal, TIDAK import prisma — supaya bisa dipakai langsung di
// client component (form pengajuan cuti) tanpa nge-bundle Prisma Client.

function toDateOnlyUTC(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

export function isoDateUTC(date: Date) {
  return toDateOnlyUTC(date).toISOString().slice(0, 10)
}

// Hari kerja = bukan Sabtu/Minggu, dan bukan tanggal di `excludedDates`
// (hari libur nasional/cuti bersama yang kantornya TIDAK tetap masuk —
// lihat NationalHoliday.isOfficeOpen). Dipakai untuk memotong saldo cuti,
// beda dari durasi kalender (cutiDurationDays) yang dipakai untuk syarat
// dokumen pendukung.
export function countWorkingDays(
  startDate: Date,
  endDate: Date,
  excludedDates: Set<string>
): number {
  const start = toDateOnlyUTC(startDate)
  const end = toDateOnlyUTC(endDate)
  if (end < start) return 0

  let count = 0
  const cursor = new Date(start)
  while (cursor.getTime() <= end.getTime()) {
    const day = cursor.getUTCDay()
    if (day !== 0 && day !== 6 && !excludedDates.has(isoDateUTC(cursor))) {
      count++
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return count
}

export function isWorkingDay(date: Date, excludedDates: Set<string>): boolean {
  const d = toDateOnlyUTC(date)
  const day = d.getUTCDay()
  return day !== 0 && day !== 6 && !excludedDates.has(isoDateUTC(d))
}

// Geser tanggal maju ke hari kerja terdekat (termasuk dirinya sendiri kalau
// sudah hari kerja) — dipakai supaya tanggal mulai dispensasi tidak pernah
// jatuh di Sabtu/Minggu/hari libur nasional.
export function nextWorkingDay(date: Date, excludedDates: Set<string>): Date {
  const result = toDateOnlyUTC(date)
  while (!isWorkingDay(result, excludedDates)) {
    result.setUTCDate(result.getUTCDate() + 1)
  }
  return result
}

// Tanggal `startDate` dihitung sebagai hari kerja ke-1 (asumsi startDate
// sendiri sudah hari kerja, lihat nextWorkingDay) — hasilnya tanggal hari
// kerja ke-`totalDays`, melompati Sabtu/Minggu/hari libur di antaranya.
// Dipakai buat kategori Dispensasi berdurasi tetap (Pasal 44).
export function addWorkingDays(
  startDate: Date,
  totalDays: number,
  excludedDates: Set<string>
): Date {
  const result = toDateOnlyUTC(startDate)
  let count = 1
  while (count < totalDays) {
    result.setUTCDate(result.getUTCDate() + 1)
    if (isWorkingDay(result, excludedDates)) count++
  }
  return result
}
