// Label & format Klaim Kesehatan — aman diimpor dari klien.

export type HealthClaimStatusValue =
  | "MENUNGGU_KONFIRMASI"
  | "REVISI"
  | "TERKONFIRMASI"
  | "DALAM_NOTA_DINAS"
  | "DISETUJUI"
  | "DIBAYAR"
  | "DITOLAK"
  | "DIBATALKAN"

export const HEALTH_CLAIM_STATUS_LABEL: Record<HealthClaimStatusValue, string> = {
  MENUNGGU_KONFIRMASI: "Menunggu Konfirmasi",
  REVISI: "Perlu Revisi",
  TERKONFIRMASI: "Terkonfirmasi",
  DALAM_NOTA_DINAS: "Dalam Nota Dinas",
  DISETUJUI: "Disetujui",
  DIBAYAR: "Dibayar",
  DITOLAK: "Ditolak",
  DIBATALKAN: "Dibatalkan",
}

// Penjelasan singkat untuk pegawai — apa yang sedang terjadi pada klaimnya.
export const HEALTH_CLAIM_STATUS_HINT: Record<HealthClaimStatusValue, string> = {
  MENUNGGU_KONFIRMASI: "Klaim sedang diperiksa petugas.",
  REVISI: "Petugas meminta Anda memperbaiki klaim.",
  TERKONFIRMASI: "Klaim sudah diperiksa dan menunggu diajukan dalam Nota Dinas.",
  DALAM_NOTA_DINAS: "Klaim sudah diajukan dalam Nota Dinas dan menunggu persetujuan.",
  DISETUJUI: "Klaim disetujui dan menunggu pembayaran.",
  DIBAYAR: "Klaim sudah dibayarkan.",
  DITOLAK: "Klaim ditolak.",
  DIBATALKAN: "Klaim dibatalkan.",
}

export const HEALTH_CLAIM_STATUS_CLASS: Record<HealthClaimStatusValue, string> = {
  MENUNGGU_KONFIRMASI: "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
  REVISI: "border-orange-300 bg-orange-50 text-orange-800 dark:border-orange-800 dark:bg-orange-950/40 dark:text-orange-300",
  TERKONFIRMASI: "border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300",
  DALAM_NOTA_DINAS: "border-indigo-300 bg-indigo-50 text-indigo-800 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300",
  DISETUJUI: "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
  DIBAYAR: "border-emerald-400 bg-emerald-100 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200",
  DITOLAK: "border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300",
  DIBATALKAN: "border-border bg-muted text-muted-foreground",
}

export type HealthClaimPatientValue = "SELF" | "SPOUSE" | "CHILD"
export const HEALTH_CLAIM_PATIENT_LABEL: Record<HealthClaimPatientValue, string> = {
  SELF: "Diri sendiri",
  SPOUSE: "Suami/Istri",
  CHILD: "Anak",
}

// Status yang masih "berjalan" — nominalnya menahan plafon.
export const IN_PROGRESS_STATUSES: HealthClaimStatusValue[] = [
  "MENUNGGU_KONFIRMASI",
  "REVISI",
  "TERKONFIRMASI",
  "DALAM_NOTA_DINAS",
]
// Status yang sudah final dan menghabiskan plafon.
export const USED_STATUSES: HealthClaimStatusValue[] = ["DISETUJUI", "DIBAYAR"]

export function formatRupiah(value: number) {
  return `Rp ${Math.round(value).toLocaleString("id-ID")}`
}

export function formatClaimDate(iso: string | null) {
  if (!iso) return "-"
  return new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  })
}

export const HEALTH_CLAIM_EVENT_LABEL: Record<string, string> = {
  DIAJUKAN: "Klaim diajukan",
  DIBATALKAN: "Klaim dibatalkan",
  REVISI: "Diminta revisi",
  DIPERBAIKI: "Klaim diperbaiki dan diajukan ulang",
  DIKONFIRMASI: "Dikonfirmasi petugas",
  DITOLAK: "Klaim ditolak",
  MASUK_NOTA_DINAS: "Masuk Nota Dinas",
  KELUAR_NOTA_DINAS: "Dikeluarkan dari Nota Dinas",
  NOMINAL_DIUBAH: "Nominal disesuaikan penyetuju",
  DISETUJUI_DIREKSI: "Disetujui Direksi",
  DITOLAK_DIREKSI: "Tidak disetujui Direksi",
  DIBAYAR: "Dibayar",
  PEMBAYARAN_DIBATALKAN: "Catatan pembayaran dibatalkan",
}

// ── Nota Dinas ───────────────────────────────────────────────
export type HealthClaimMemoStatusValue =
  | "MENUNGGU_PERSETUJUAN"
  | "DIKEMBALIKAN"
  | "DISETUJUI"
  | "DITOLAK"
  | "DIBATALKAN"
  | "DIBAYAR"

export const MEMO_STATUS_LABEL: Record<HealthClaimMemoStatusValue, string> = {
  MENUNGGU_PERSETUJUAN: "Menunggu Persetujuan",
  DIKEMBALIKAN: "Dikembalikan",
  DISETUJUI: "Disetujui Direksi",
  DITOLAK: "Tidak Disetujui",
  DIBATALKAN: "Dibatalkan",
  DIBAYAR: "Dibayar",
}

export const MEMO_STATUS_CLASS: Record<HealthClaimMemoStatusValue, string> = {
  MENUNGGU_PERSETUJUAN: HEALTH_CLAIM_STATUS_CLASS.DALAM_NOTA_DINAS,
  DIKEMBALIKAN: HEALTH_CLAIM_STATUS_CLASS.REVISI,
  DISETUJUI: HEALTH_CLAIM_STATUS_CLASS.DISETUJUI,
  DITOLAK: HEALTH_CLAIM_STATUS_CLASS.DITOLAK,
  DIBATALKAN: HEALTH_CLAIM_STATUS_CLASS.DIBATALKAN,
  DIBAYAR: HEALTH_CLAIM_STATUS_CLASS.DIBAYAR,
}

export type MemoStepTypeValue = "ATASAN_LANGSUNG" | "KEPALA_DEPARTEMEN" | "PEGAWAI_TERTENTU" | "DISPOSISI_DIREKTUR"
export const MEMO_STEP_TYPE_LABEL: Record<MemoStepTypeValue, string> = {
  ATASAN_LANGSUNG: "Atasan Langsung pembuat",
  KEPALA_DEPARTEMEN: "Kepala Bagian pembuat",
  PEGAWAI_TERTENTU: "Pegawai Tertentu",
  DISPOSISI_DIREKTUR: "Disposisi Direktur",
}

export type DispositionValue = "SETUJU" | "SETUJU_CATATAN" | "TINJAU_ULANG" | "TIDAK_SETUJU"
export const DISPOSITION_LABEL: Record<DispositionValue, string> = {
  SETUJU: "Setuju, proses pembayaran",
  SETUJU_CATATAN: "Setuju dengan catatan",
  TINJAU_ULANG: "Tinjau ulang",
  TIDAK_SETUJU: "Tidak disetujui",
}

export type MemoStepStatusValue = "MENUNGGU" | "AKTIF" | "DISETUJUI" | "DIKEMBALIKAN" | "DITOLAK" | "DILEWATI" | "DIBATALKAN"
export const MEMO_STEP_STATUS_LABEL: Record<MemoStepStatusValue, string> = {
  MENUNGGU: "Belum gilirannya",
  AKTIF: "Menunggu tindakan",
  DISETUJUI: "Disetujui",
  DIKEMBALIKAN: "Dikembalikan",
  DITOLAK: "Tidak disetujui",
  DILEWATI: "Dilewati",
  DIBATALKAN: "Dibatalkan",
}

export const DEFAULT_MEMO_OPENING =
  "Berdasarkan Surat Keputusan Direksi No.01 Tahun 2024 Tentang Penggantian Biaya Pengobatan Pegawai. Bersama ini kami Bagian Personalia dan Umum mengajukan biaya tersebut yaitu sebesar {total} ( {terbilang} ). Dengan rincian sebagai berikut :"
export const DEFAULT_MEMO_CLOSING =
  "Anggaran untuk pengajuan ini dibebankan pada post Biaya Tenaga Kerja Lainnya.\nDemikian permohonan kami, atas perhatian dan persetujuannya kami ucapkan terima kasih."

// ── Periode plafon ───────────────────────────────────────────
// Periode plafon dimulai pada bulan `startMonth` (1–12) dan diberi "tahun"
// sesuai tahun bulan awalnya. Contoh startMonth=3: berobat 10 Feb 2027 masuk
// periode 2026 (Mar 2026 – Feb 2027).

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"]
export const MONTH_NAMES = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"]

// year & month0 = tahun dan bulan (0-based) tanggal berobat.
export function plafonPeriodYear(year: number, month0: number, startMonth: number) {
  return month0 + 1 >= startMonth ? year : year - 1
}

export function plafonPeriodYearOfIso(iso: string, startMonth: number) {
  return plafonPeriodYear(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, startMonth)
}

export function plafonPeriodLabel(periodYear: number, startMonth: number) {
  if (startMonth === 1) return String(periodYear)
  const endMonth = startMonth - 1 // 1-based, di tahun berikutnya
  return `${MONTH_SHORT[startMonth - 1]} ${periodYear} – ${MONTH_SHORT[endMonth - 1]} ${periodYear + 1}`
}
