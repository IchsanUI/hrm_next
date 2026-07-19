import { z } from "zod"

import { addWorkingDays, nextWorkingDay } from "@/lib/working-days"

export const DISPENSATION_CATEGORIES = [
  "PERNIKAHAN_SENDIRI",
  "KELUARGA_INTI_MENINGGAL",
  "ORANG_TUA_MERTUA_MENINGGAL",
  "MENIKAHKAN_ANAK",
  "ISTRI_MELAHIRKAN_KEGUGURAN",
  "KHITAN_ANAK",
  "KELUARGA_SERUMAH_MENINGGAL",
  "PINDAH_RUMAH",
  "MELAYAT",
  "PANGGILAN_INSTANSI_PEMERINTAH",
  "MENGURUS_SIM",
  "UJIAN_PERGURUAN_TINGGI",
] as const

export type DispensationCategory = (typeof DISPENSATION_CATEGORIES)[number]

export const DISPENSATION_CATEGORY_LABEL: Record<DispensationCategory, string> = {
  PERNIKAHAN_SENDIRI: "Pegawai melaksanakan pernikahan",
  KELUARGA_INTI_MENINGGAL: "Suami/Istri, anak kandung/angkat meninggal dunia",
  ORANG_TUA_MERTUA_MENINGGAL: "Orang tua/mertua meninggal dunia",
  MENIKAHKAN_ANAK: "Menikahkan anak kandung/angkat",
  ISTRI_MELAHIRKAN_KEGUGURAN: "Istri melahirkan atau keguguran kandungan",
  KHITAN_ANAK: "Mengkhitankan anak",
  KELUARGA_SERUMAH_MENINGGAL: "Anggota keluarga dalam satu rumah meninggal dunia",
  PINDAH_RUMAH: "Pegawai pindah rumah",
  MELAYAT: "Melayat keluarga, tetangga dekat, atau rekan yang meninggal dunia",
  PANGGILAN_INSTANSI_PEMERINTAH: "Memenuhi panggilan resmi dari instansi pemerintah",
  MENGURUS_SIM: "Mengurus SIM",
  UJIAN_PERGURUAN_TINGGI:
    "Mengikuti ujian di Perguruan Tinggi (sudah lapor ke perusahaan sebelumnya)",
}

// null = "berdasarkan perhitungan waktu yang wajar" (Pasal 44 ayat 4) —
// durasinya bebas dipilih pemohon, dinilai kewajarannya oleh approver saat
// approval, bukan dibatasi sistem.
export const DISPENSATION_CATEGORY_FIXED_DAYS: Record<DispensationCategory, number | null> = {
  PERNIKAHAN_SENDIRI: 3,
  KELUARGA_INTI_MENINGGAL: 2,
  ORANG_TUA_MERTUA_MENINGGAL: 2,
  MENIKAHKAN_ANAK: 2,
  ISTRI_MELAHIRKAN_KEGUGURAN: 2,
  KHITAN_ANAK: 2,
  KELUARGA_SERUMAH_MENINGGAL: 1,
  PINDAH_RUMAH: 1,
  MELAYAT: null,
  PANGGILAN_INSTANSI_PEMERINTAH: null,
  MENGURUS_SIM: null,
  UJIAN_PERGURUAN_TINGGI: null,
}

function todayDateString() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function dispensationDurationDays(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00.000Z`)
  const end = new Date(`${endDate}T00:00:00.000Z`)
  return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
}

// Tanggal mulai TIDAK PERNAH boleh jatuh di Sabtu/Minggu/hari libur nasional
// (yang bukan "kantor tetap masuk") — otomatis digeser ke hari kerja
// berikutnya. Dipakai di form (live) dan server (validasi ulang).
export function resolveDispensationStartDate(startDate: string, excludedDates: Set<string>) {
  const shifted = nextWorkingDay(new Date(`${startDate}T00:00:00.000Z`), excludedDates)
  return shifted.toISOString().slice(0, 10)
}

// Kategori berdurasi tetap: tanggal selesai dihitung otomatis dari tanggal
// mulai + jatah harinya, MELOMPATI Sabtu/Minggu/hari libur di antaranya
// (dipakai form & server supaya tidak bisa diakali lewat endDate yang beda
// dari aturan kategori).
export function computeDispensationEndDate(
  category: DispensationCategory,
  startDate: string,
  excludedDates: Set<string>
) {
  const fixedDays = DISPENSATION_CATEGORY_FIXED_DAYS[category]
  if (fixedDays === null) return null
  const start = new Date(`${startDate}T00:00:00.000Z`)
  return addWorkingDays(start, fixedDays, excludedDates).toISOString().slice(0, 10)
}

export const dispensationRequestSchema = z
  .object({
    category: z.enum(DISPENSATION_CATEGORIES),
    startDate: z.string().min(1, "Tanggal mulai wajib diisi"),
    endDate: z.string().min(1, "Tanggal selesai wajib diisi"),
    reason: z.string().min(1, "Keterangan wajib diisi"),
    substituteEmployeeId: z.coerce.number().int().positive().optional().or(z.literal("")),
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: "Tanggal selesai tidak boleh sebelum tanggal mulai",
    path: ["endDate"],
  })
  .refine((data) => data.startDate >= todayDateString(), {
    message: "Tanggal mulai tidak boleh di hari yang sudah lewat",
    path: ["startDate"],
  })

export const dispensationRejectionSchema = z.object({
  rejectionReason: z.string().min(1, "Alasan penolakan wajib diisi"),
})

export const dispensationRevisionSchema = z.object({
  rejectionReason: z.string().min(1, "Alasan tidak bersedia wajib diisi"),
})

export const dispensationResubmitSchema = z.object({
  newSubstituteEmployeeId: z.coerce.number().int().positive("Pilih pegawai pengganti baru"),
})
