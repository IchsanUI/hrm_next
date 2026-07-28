import { prisma } from "@/lib/prisma"
import { DISPENSATION_CATEGORY_LABEL } from "@/lib/validations/dispensation"
import { computeMaternityLeaveBreakdown } from "@/lib/validations/maternity-leave"
import { OFFICE_EXIT_CATEGORY_LABEL, type IzinMonitoringRow } from "@/lib/izin-monitoring"
import { IZIN_MONITORING_KIND_OPTIONS } from "@/lib/izin-monitoring-constants"
import { APPROVER_TYPE_LABEL, type ApproverType } from "@/lib/approval-step-labels"
import { CUTI_DOCUMENT_REQUIRED_THRESHOLD_DAYS } from "@/lib/validations/cuti"

export type IzinPrintSelection = { kind: IzinMonitoringRow["kind"]; publicId: string }

const VALID_KINDS = new Set(IZIN_MONITORING_KIND_OPTIONS.map((o) => o.value))

// Parse format "kind:publicId,kind:publicId" dari query string `items` —
// dipakai app/admin/izin/monitoring/cetak/page.tsx. Entri yang tidak valid
// (kind tidak dikenal / publicId kosong) dilewati diam-diam alih-alih error,
// supaya satu baris rusak tidak menggagalkan cetakan baris lain.
export function parseIzinPrintSelections(raw: string | undefined): IzinPrintSelection[] {
  if (!raw) return []
  return raw
    .split(",")
    .map((entry) => {
      const [kind, publicId] = entry.split(":")
      return { kind, publicId } as IzinPrintSelection
    })
    .filter((s) => s.publicId && VALID_KINDS.has(s.kind))
}

export type ApprovalColumnPrint = {
  label: string
  // Baris kedua di header kolom (khusus format Surat Perintah Lembur, mis.
  // "Pemohon," di bawah "Dibuat", atau "Personalia" di bawah "Mengetahui &
  // Menyetujui") — kosong/undefined di format generik yang lain.
  sublabel?: string
  status: "WAITING" | "IN_PROGRESS" | "APPROVED" | "REJECTED" | "REVISED" | "SKIPPED"
  signerName: string | null
  signatureUrl: string | null
  // Kapan step ini disetujui/ditolak — dipakai buat catatan waktu approve
  // & alur di Catatan pada surat cetak.
  actedAt: string | null
}

export type IzinPrintDocument = {
  publicId: string
  kind: IzinMonitoringRow["kind"]
  perihal: string
  applicantName: string
  applicantNumber: string
  applicantPosition: string
  cityDateLabel: string
  infoRows: { label: string; value: string }[]
  approvalColumns: ApprovalColumnPrint[]
  applicantColumn: ApprovalColumnPrint
  noteWarning: string | null
  attachments: { label: string; url: string }[]
  letterheadUrl: string | null // IzinSettings.letterheadUrl — null = PDF tampil tanpa kop surat
}

// Satu sumber ambil kop surat Izin — dipakai ketiga fungsi getXPrintDocuments
// di bawah, supaya query-nya cuma sekali per pemanggilan (bukan per baris)
// dan konsisten di semua format cetak (generik, formal, Surat Perintah
// Lembur).
async function getIzinLetterheadUrl(): Promise<string | null> {
  const settings = await prisma.izinSettings.findUnique({ where: { id: 1 } })
  return settings?.letterheadUrl ?? null
}

// Format "Surat Permohonan Cuti" resmi (lihat CutiFormalPrintDocument di
// bawah) — dipakai untuk pengajuan Cuti Tahunan >3 hari, Cuti Bersalin/Gugur
// Kandungan, Cuti Khusus (Haji/Umroh), dan Cuti Besar. Kind lain tetap pakai
// IzinPrintPage generik di atas.
export type CutiFormalKind = "cuti" | "cuti_bersalin" | "cuti_khusus" | "cuti_besar"

const CUTI_FORMAL_KINDS = new Set<CutiFormalKind>(["cuti", "cuti_bersalin", "cuti_khusus", "cuti_besar"])

function formatDate(date: Date) {
  return date.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })
}

function formatDateLong(date: Date) {
  return date.toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" })
}

function formatDateTime(date: Date) {
  return `${formatDate(date)}, ${date.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`
}

// Format jam manual "H:mm AM/PM" (bukan toLocaleTimeString) — konsisten
// sama gaya formatTime12h di bawah yang dipakai buat jam lembur.
function formatClockAmPm(date: Date) {
  const h = date.getHours()
  const m = date.getMinutes()
  const period = h >= 12 ? "PM" : "AM"
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${String(m).padStart(2, "0")} ${period}`
}

// Label "Alternate / Pengganti" sengaja beda dari APPROVER_TYPE_LABEL biasa
// (yang isinya "Pegawai Pengganti (Konfirmasi)") — cuma dipakai buat cetakan
// biar match format existing, tidak mengubah label yang dipakai di UI approval.
const PRINT_APPROVER_LABEL: Record<ApproverType, string> = {
  ...APPROVER_TYPE_LABEL,
  PEGAWAI_PENGGANTI: "Alternate / Pengganti",
}

type StepLike = {
  approverType: ApproverType
  status: string
  actedAt: Date | null
  notes: string | null
  approverEmployee: { fullName: string; signatureUrl: string | null } | null
}

// Step SKIPPED (mis. Pegawai Pengganti kalau tidak dipakai) sengaja
// di-exclude — itu yang bikin jumlah kolom approval beda-beda per pengajuan
// (lihat contoh format: Sakit ada kolom Alternate/Pengganti, Pulang Cepat
// tidak, tergantung apakah step itu jalan atau di-skip).
function buildApprovalColumns(steps: StepLike[]): ApprovalColumnPrint[] {
  return steps
    .filter((s) => s.status !== "SKIPPED")
    .map((s) => ({
      label: PRINT_APPROVER_LABEL[s.approverType],
      status: s.status as ApprovalColumnPrint["status"],
      signerName: s.approverEmployee?.fullName ?? null,
      signatureUrl: s.approverEmployee?.signatureUrl ?? null,
      actedAt: s.actedAt ? formatDateTime(s.actedAt) : null,
    }))
}

function applicantColumnOf(employee: { fullName: string; signatureUrl: string | null }): ApprovalColumnPrint {
  return {
    label: "Pemohon",
    status: "APPROVED",
    signerName: employee.fullName,
    signatureUrl: employee.signatureUrl,
    actedAt: null,
  }
}

function cityDateOf(date: Date) {
  return `Gresik, ${formatDateLong(date)}`
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10)
}

function formatIsoDate(iso: string) {
  return formatDate(new Date(`${iso}T00:00:00.000Z`))
}

function totalDaysBetween(startDate: Date, endDate: Date) {
  return Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
}

const TERBILANG_ONES = [
  "", "satu", "dua", "tiga", "empat", "lima", "enam", "tujuh", "delapan", "sembilan", "sepuluh",
  "sebelas", "dua belas", "tiga belas", "empat belas", "lima belas", "enam belas", "tujuh belas",
  "delapan belas", "sembilan belas",
]

// Angka ke kata Indonesia — cuma perlu menangani rentang wajar durasi cuti
// (0-99x hari, mis. Cuti Besar/Khusus Haji maks ~40-60 hari), bukan
// implementasi umum tak terbatas.
function numberToIndonesianWords(n: number): string {
  if (n < 20) return TERBILANG_ONES[n]
  if (n < 100) {
    const tens = Math.floor(n / 10)
    const rest = n % 10
    return rest === 0 ? `${TERBILANG_ONES[tens]} puluh` : `${TERBILANG_ONES[tens]} puluh ${TERBILANG_ONES[rest]}`
  }
  const hundreds = Math.floor(n / 100)
  const rest = n % 100
  const prefix = hundreds === 1 ? "seratus" : `${TERBILANG_ONES[hundreds]} ratus`
  return rest === 0 ? prefix : `${prefix} ${numberToIndonesianWords(rest)}`
}

// Ringkasan cuti yang sudah dipakai pegawai pada tahun mulai cuti yang
// diajukan — bagian "Catatan Pejabat Kepegawaian" di Surat Permohonan Cuti.
// Dihitung dinamis dari pengajuan APPROVED (hari kalender, inklusif), bukan
// disimpan — konsisten dengan pendekatan lib/leave-balance.ts.
export type LeaveConsumptionSummary = {
  cutiTahunanHari: number
  cutiBesarHari: number
  cutiSakitHari: number
  cutiMelahirkanHari: number
}

async function getLeaveConsumptionSummary(employeeId: number, year: number): Promise<LeaveConsumptionSummary> {
  const yearStart = new Date(Date.UTC(year, 0, 1))
  const yearEnd = new Date(Date.UTC(year, 11, 31))
  const overlapsYear = { startDate: { lte: yearEnd }, endDate: { gte: yearStart } }

  const [cutiRows, cutiBesarRows, sakitRows, melahirkanRows] = await Promise.all([
    prisma.cutiRequest.findMany({
      where: { employeeId, status: "APPROVED", ...overlapsYear },
      select: { startDate: true, endDate: true },
    }),
    prisma.cutiBesarRequest.findMany({
      where: { employeeId, status: "APPROVED", ...overlapsYear },
      select: { startDate: true, endDate: true },
    }),
    prisma.sickLeaveRequest.findMany({
      where: { employeeId, status: "APPROVED", ...overlapsYear },
      select: { startDate: true, endDate: true },
    }),
    prisma.maternityLeaveRequest.findMany({
      where: { employeeId, status: "APPROVED", ...overlapsYear },
      select: { startDate: true, endDate: true },
    }),
  ])

  const sumDays = (rows: { startDate: Date; endDate: Date }[]) =>
    rows.reduce((total, r) => total + totalDaysBetween(r.startDate, r.endDate), 0)

  return {
    cutiTahunanHari: sumDays(cutiRows),
    cutiBesarHari: sumDays(cutiBesarRows),
    cutiSakitHari: sumDays(sakitRows),
    cutiMelahirkanHari: sumDays(melahirkanRows),
  }
}

// 3 kolom "Catatan/Pertimbangan" di Surat Permohonan Cuti — beda dari
// ApprovalColumnPrint biasa: bukan cuma tanda tangan, tapi kotak berisi
// catatan/pertimbangan approver (diisi saat approve, lihat server actions)
// plus "note kecil" ringkasan status/penandatangan/waktu di bawahnya.
export type ConsiderationColumnPrint = {
  label: string
  note: string | null
  status: ApprovalColumnPrint["status"]
  signerName: string | null
  signatureUrl: string | null
  actedAt: string | null
}

const CONSIDERATION_COLUMN_LABEL: Partial<Record<ApproverType, string>> = {
  ATASAN_LANGSUNG: "Catatan/Pertimbangan Atasan Langsung",
  KEPALA_DEPARTEMEN: "Catatan/Pertimbangan Kepala Departemen",
  HR: "Catatan/Pertimbangan Kabag. Personalia & Umum",
  DIREKSI: "Keputusan Direksi",
  PEGAWAI_TERTENTU: "Catatan/Pertimbangan",
}

function buildConsiderationColumns(steps: StepLike[]): ConsiderationColumnPrint[] {
  return steps
    .filter((s) => s.status !== "SKIPPED" && s.approverType !== "PEGAWAI_PENGGANTI")
    .map((s) => ({
      label: CONSIDERATION_COLUMN_LABEL[s.approverType] ?? PRINT_APPROVER_LABEL[s.approverType],
      note: s.notes,
      status: s.status as ConsiderationColumnPrint["status"],
      signerName: s.approverEmployee?.fullName ?? null,
      signatureUrl: s.approverEmployee?.signatureUrl ?? null,
      actedAt: s.actedAt ? formatDateTime(s.actedAt) : null,
    }))
}

// Data konfirmasi Pegawai Pengganti — dipisah dari considerationColumns
// (yang cuma buat 3 kolom Atasan Langsung/Kabag Personalia/Direksi) karena
// Pengganti bukan approval biasa, cuma menyatakan bersedia/tidak. "Kapan"
// diambil dari actedAt step PEGAWAI_PENGGANTI, tanda tangannya dari
// Employee.signatureUrl si pengganti (approverEmployee step tsb).
export type SubstitutePrint = {
  name: string
  note: string | null
  status: ApprovalColumnPrint["status"] | null
  actedAt: string | null
  signatureUrl: string | null
}

function substituteOf(
  substituteEmployeeName: string | null,
  substituteEmployeeFullName: string | undefined,
  steps: StepLike[]
): SubstitutePrint | null {
  const name = substituteEmployeeName ?? substituteEmployeeFullName ?? null
  if (!name) return null
  const step = steps.find((s) => s.approverType === "PEGAWAI_PENGGANTI")
  return {
    name,
    note: step?.notes ?? null,
    status: (step?.status as ApprovalColumnPrint["status"]) ?? null,
    actedAt: step?.actedAt ? formatDateTime(step.actedAt) : null,
    signatureUrl: step?.approverEmployee?.signatureUrl ?? null,
  }
}

export type CutiFormalPrintDocument = {
  publicId: string
  kind: CutiFormalKind
  applicantName: string
  applicantNumber: string
  applicantPosition: string
  submissionDateLabel: string
  leaveTypeLabel: string
  durationLabel: string
  startDateLabel: string
  endDateLabel: string
  applicantAddress: string
  applicantPhone: string
  attachmentNote: string | null
  cityDateLabel: string
  signerName: string | null
  signerSignatureUrl: string | null
  substitute: SubstitutePrint | null
  leaveConsumption: LeaveConsumptionSummary
  considerationColumns: ConsiderationColumnPrint[]
  attachments: { label: string; url: string }[]
  letterheadUrl: string | null
}

function durationLabelOf(days: number) {
  return `${days} (${numberToIndonesianWords(days)}) hari kerja`
}

const employeeSelect = {
  fullName: true,
  employeeNumber: true,
  signatureUrl: true,
  position: { select: { name: true } },
} as const

// Dipakai khusus Surat Permohonan Cuti formal — butuh alamat & nomor telepon
// pemohon buat kalimat "bersedia dihubungi untuk urusan pekerjaan".
const employeeContactSelect = {
  ...employeeSelect,
  address: true,
  phone: true,
} as const

const approverEmployeeSelect = { select: { fullName: true, signatureUrl: true } }

// Query per kind SEKALI pakai `publicId: { in: [...] }` (bukan N+1 per item)
// — dipanggil dari app/admin/izin/monitoring/cetak/page.tsx dengan daftar
// pengajuan yang dicentang user di Monitoring Izin.
export async function getIzinPrintDocuments(
  selections: IzinPrintSelection[]
): Promise<IzinPrintDocument[]> {
  const idsByKind = new Map<IzinPrintSelection["kind"], string[]>()
  for (const s of selections) {
    idsByKind.set(s.kind, [...(idsByKind.get(s.kind) ?? []), s.publicId])
  }

  // letterheadUrl SENGAJA belum dimasukkan di sini — cuma satu nilai yang
  // sama buat semua dokumen di batch ini, jadi diambil sekali & digabungkan
  // di langkah terakhir (lihat `return` di bawah), bukan diulang di tiap
  // `documentsByPublicId.set(...)`.
  const documentsByPublicId = new Map<string, Omit<IzinPrintDocument, "letterheadUrl">>()

  const officeExitIds = idsByKind.get("meninggalkan_kantor")
  if (officeExitIds) {
    const rows = await prisma.officeExitRequest.findMany({
      where: { publicId: { in: officeExitIds } },
      include: {
        employee: { select: employeeSelect },
        approvalSteps: { orderBy: { order: "asc" }, include: { approverEmployee: approverEmployeeSelect } },
      },
    })
    for (const r of rows) {
      documentsByPublicId.set(r.publicId, {
        publicId: r.publicId,
        kind: "meninggalkan_kantor",
        perihal: "Surat Izin Meninggalkan Kantor",
        applicantName: r.employee.fullName,
        applicantNumber: r.employee.employeeNumber,
        applicantPosition: r.employee.position.name,
        cityDateLabel: cityDateOf(r.createdAt),
        infoRows: [
          { label: "Keperluan", value: `${OFFICE_EXIT_CATEGORY_LABEL[r.category]} — ${r.reason}` },
          { label: "Jam", value: r.plannedExitTime },
        ],
        approvalColumns: buildApprovalColumns(r.approvalSteps),
        applicantColumn: applicantColumnOf(r.employee),
        noteWarning: null,
        attachments: [],
      })
    }
  }

  const earlyLeaveIds = idsByKind.get("pulang_cepat")
  if (earlyLeaveIds) {
    const rows = await prisma.earlyLeaveRequest.findMany({
      where: { publicId: { in: earlyLeaveIds } },
      include: {
        employee: { select: employeeSelect },
        approvalSteps: { orderBy: { order: "asc" }, include: { approverEmployee: approverEmployeeSelect } },
      },
    })
    for (const r of rows) {
      documentsByPublicId.set(r.publicId, {
        publicId: r.publicId,
        kind: "pulang_cepat",
        perihal: "Surat Izin Pulang Cepat",
        applicantName: r.employee.fullName,
        applicantNumber: r.employee.employeeNumber,
        applicantPosition: r.employee.position.name,
        cityDateLabel: cityDateOf(r.createdAt),
        infoRows: [
          { label: "Keperluan", value: r.detail },
          { label: "Jam", value: r.plannedLeaveTime },
        ],
        approvalColumns: buildApprovalColumns(r.approvalSteps),
        applicantColumn: applicantColumnOf(r.employee),
        noteWarning: null,
        attachments: [],
      })
    }
  }

  const lateArrivalIds = idsByKind.get("terlambat")
  if (lateArrivalIds) {
    const rows = await prisma.lateArrivalRequest.findMany({
      where: { publicId: { in: lateArrivalIds } },
      include: {
        employee: { select: employeeSelect },
        approvalSteps: { orderBy: { order: "asc" }, include: { approverEmployee: approverEmployeeSelect } },
      },
    })
    for (const r of rows) {
      documentsByPublicId.set(r.publicId, {
        publicId: r.publicId,
        kind: "terlambat",
        perihal: "Surat Izin Terlambat",
        applicantName: r.employee.fullName,
        applicantNumber: r.employee.employeeNumber,
        applicantPosition: r.employee.position.name,
        cityDateLabel: cityDateOf(r.createdAt),
        infoRows: [
          { label: "Alasan Terlambat", value: r.reason },
          {
            label: "Jam Konfirmasi",
            value: r.arrivalConfirmedAt ? formatClockAmPm(r.arrivalConfirmedAt) : "Belum Dikonfirmasi",
          },
        ],
        approvalColumns: buildApprovalColumns(r.approvalSteps),
        applicantColumn: applicantColumnOf(r.employee),
        noteWarning:
          r.arrivalConfirmedByAdmin && r.arrivalConfirmedByAdminAt
            ? `Kedatangan dikoreksi manual oleh Admin ${r.arrivalConfirmedByAdmin} pada ${formatDateTime(r.arrivalConfirmedByAdminAt)} — bukan konfirmasi mandiri oleh pegawai.`
            : null,
        attachments: [{ label: "Foto Pendukung", url: r.evidenceUrl }],
      })
    }
  }

  const sickLeaveIds = idsByKind.get("sakit")
  if (sickLeaveIds) {
    const rows = await prisma.sickLeaveRequest.findMany({
      where: { publicId: { in: sickLeaveIds } },
      include: {
        employee: { select: employeeSelect },
        approvalSteps: { orderBy: { order: "asc" }, include: { approverEmployee: approverEmployeeSelect } },
      },
    })
    for (const r of rows) {
      const sameDay = r.startDate.getTime() === r.endDate.getTime()
      documentsByPublicId.set(r.publicId, {
        publicId: r.publicId,
        kind: "sakit",
        perihal: "Surat Izin Tidak Masuk Kerja (Sakit)",
        applicantName: r.employee.fullName,
        applicantNumber: r.employee.employeeNumber,
        applicantPosition: r.employee.position.name,
        cityDateLabel: cityDateOf(r.createdAt),
        infoRows: [
          { label: "Keperluan", value: r.reason },
          {
            label: "Tanggal Izin",
            value: sameDay ? formatDate(r.startDate) : `${formatDate(r.startDate)} — ${formatDate(r.endDate)}`,
          },
        ],
        approvalColumns: buildApprovalColumns(r.approvalSteps),
        applicantColumn: applicantColumnOf(r.employee),
        noteWarning: r.medicalCertificateUrl
          ? null
          : `Pegawai Belum Upload File Pendukung / Surat Dokter oleh ${r.employee.fullName}`,
        attachments: r.medicalCertificateUrl
          ? [{ label: "Surat Dokter", url: r.medicalCertificateUrl }]
          : [],
      })
    }
  }

  const cutiIds = idsByKind.get("cuti")
  if (cutiIds) {
    const rows = await prisma.cutiRequest.findMany({
      where: { publicId: { in: cutiIds } },
      include: {
        employee: { select: employeeSelect },
        approvalSteps: { orderBy: { order: "asc" }, include: { approverEmployee: approverEmployeeSelect } },
      },
    })
    for (const r of rows) {
      documentsByPublicId.set(r.publicId, {
        publicId: r.publicId,
        kind: "cuti",
        perihal: "Surat Izin Cuti",
        applicantName: r.employee.fullName,
        applicantNumber: r.employee.employeeNumber,
        applicantPosition: r.employee.position.name,
        cityDateLabel: cityDateOf(r.createdAt),
        infoRows: [
          { label: "Alasan", value: r.reason },
          { label: "Tanggal Izin", value: `${formatDate(r.startDate)} — ${formatDate(r.endDate)}` },
        ],
        approvalColumns: buildApprovalColumns(r.approvalSteps),
        applicantColumn: applicantColumnOf(r.employee),
        noteWarning: null,
        attachments: r.supportingDocumentUrl
          ? [{ label: "Dokumen Pendukung", url: r.supportingDocumentUrl }]
          : [],
      })
    }
  }

  const maternityIds = idsByKind.get("cuti_bersalin")
  if (maternityIds) {
    const rows = await prisma.maternityLeaveRequest.findMany({
      where: { publicId: { in: maternityIds } },
      include: {
        employee: { select: employeeSelect },
        approvalSteps: { orderBy: { order: "asc" }, include: { approverEmployee: approverEmployeeSelect } },
      },
    })
    for (const r of rows) {
      const breakdown = computeMaternityLeaveBreakdown(r.type, isoDate(r.referenceDate))
      documentsByPublicId.set(r.publicId, {
        publicId: r.publicId,
        kind: "cuti_bersalin",
        perihal: r.type === "BERSALIN" ? "Surat Cuti Bersalin" : "Surat Cuti Gugur Kandungan",
        applicantName: r.employee.fullName,
        applicantNumber: r.employee.employeeNumber,
        applicantPosition: r.employee.position.name,
        cityDateLabel: cityDateOf(r.createdAt),
        infoRows: [
          { label: r.type === "BERSALIN" ? "HPL" : "Tanggal Kejadian", value: formatDate(r.referenceDate) },
          { label: "Tanggal Izin", value: `${formatDate(r.startDate)} — ${formatDate(r.endDate)}` },
          { label: "Alasan", value: r.reason ?? "-" },
          ...(breakdown.beforeRangeStart && breakdown.beforeRangeEnd
            ? [
                {
                  label: "1,5 Bulan Sebelum HPL",
                  value: `${formatIsoDate(breakdown.beforeRangeStart)} — ${formatIsoDate(breakdown.beforeRangeEnd)}`,
                },
              ]
            : []),
          {
            label: r.type === "BERSALIN" ? "1,5 Bulan Setelah HPL" : "1,5 Bulan Setelahnya",
            value: `${formatIsoDate(breakdown.afterRangeStart)} — ${formatIsoDate(breakdown.afterRangeEnd)}`,
          },
          { label: "Total Cuti (Pasal 37)", value: `${totalDaysBetween(r.startDate, r.endDate)} hari` },
        ],
        approvalColumns: buildApprovalColumns(r.approvalSteps),
        applicantColumn: applicantColumnOf(r.employee),
        noteWarning: null,
        attachments: [{ label: "Dokumen Pendukung", url: r.supportingDocumentUrl }],
      })
    }
  }

  const specialLeaveIds = idsByKind.get("cuti_khusus")
  if (specialLeaveIds) {
    const rows = await prisma.specialLeaveRequest.findMany({
      where: { publicId: { in: specialLeaveIds } },
      include: {
        employee: { select: employeeSelect },
        approvalSteps: { orderBy: { order: "asc" }, include: { approverEmployee: approverEmployeeSelect } },
      },
    })
    for (const r of rows) {
      documentsByPublicId.set(r.publicId, {
        publicId: r.publicId,
        kind: "cuti_khusus",
        perihal: r.type === "HAJI" ? "Surat Cuti Khusus Haji" : "Surat Cuti Khusus Umroh",
        applicantName: r.employee.fullName,
        applicantNumber: r.employee.employeeNumber,
        applicantPosition: r.employee.position.name,
        cityDateLabel: cityDateOf(r.createdAt),
        infoRows: [
          { label: "Tanggal Izin", value: `${formatDate(r.startDate)} — ${formatDate(r.endDate)}` },
          { label: "Alasan", value: r.reason ?? "-" },
        ],
        approvalColumns: buildApprovalColumns(r.approvalSteps),
        applicantColumn: applicantColumnOf(r.employee),
        noteWarning: null,
        attachments: [{ label: "Bukti Pendaftaran", url: r.supportingDocumentUrl }],
      })
    }
  }

  const dispensationIds = idsByKind.get("dispensasi")
  if (dispensationIds) {
    const rows = await prisma.dispensationRequest.findMany({
      where: { publicId: { in: dispensationIds } },
      include: {
        employee: { select: employeeSelect },
        approvalSteps: { orderBy: { order: "asc" }, include: { approverEmployee: approverEmployeeSelect } },
      },
    })
    for (const r of rows) {
      documentsByPublicId.set(r.publicId, {
        publicId: r.publicId,
        kind: "dispensasi",
        perihal: "Surat Dispensasi",
        applicantName: r.employee.fullName,
        applicantNumber: r.employee.employeeNumber,
        applicantPosition: r.employee.position.name,
        cityDateLabel: cityDateOf(r.createdAt),
        infoRows: [
          { label: "Kategori", value: DISPENSATION_CATEGORY_LABEL[r.category] },
          { label: "Tanggal Izin", value: `${formatDate(r.startDate)} — ${formatDate(r.endDate)}` },
          { label: "Alasan", value: r.reason },
        ],
        approvalColumns: buildApprovalColumns(r.approvalSteps),
        applicantColumn: applicantColumnOf(r.employee),
        noteWarning: null,
        attachments: r.supportingDocumentUrl
          ? [{ label: "Dokumen Pendukung", url: r.supportingDocumentUrl }]
          : [],
      })
    }
  }

  const cutiBesarIds = idsByKind.get("cuti_besar")
  if (cutiBesarIds) {
    const rows = await prisma.cutiBesarRequest.findMany({
      where: { publicId: { in: cutiBesarIds } },
      include: {
        employee: { select: employeeSelect },
        approvalSteps: { orderBy: { order: "asc" }, include: { approverEmployee: approverEmployeeSelect } },
      },
    })
    for (const r of rows) {
      documentsByPublicId.set(r.publicId, {
        publicId: r.publicId,
        kind: "cuti_besar",
        perihal: "Surat Cuti Besar",
        applicantName: r.employee.fullName,
        applicantNumber: r.employee.employeeNumber,
        applicantPosition: r.employee.position.name,
        cityDateLabel: cityDateOf(r.createdAt),
        infoRows: [
          { label: "Tanggal Izin", value: `${formatDate(r.startDate)} — ${formatDate(r.endDate)}` },
          { label: "Alasan", value: r.reason ?? "-" },
        ],
        approvalColumns: buildApprovalColumns(r.approvalSteps),
        applicantColumn: applicantColumnOf(r.employee),
        noteWarning: null,
        attachments: r.supportingDocumentUrl
          ? [{ label: "Dokumen Pendukung", url: r.supportingDocumentUrl }]
          : [],
      })
    }
  }

  const unpaidLeaveIds = idsByKind.get("cuti_diluar_tanggungan")
  if (unpaidLeaveIds) {
    const rows = await prisma.unpaidLeaveRequest.findMany({
      where: { publicId: { in: unpaidLeaveIds } },
      include: {
        employee: { select: employeeSelect },
        approvalSteps: { orderBy: { order: "asc" }, include: { approverEmployee: approverEmployeeSelect } },
      },
    })
    for (const r of rows) {
      documentsByPublicId.set(r.publicId, {
        publicId: r.publicId,
        kind: "cuti_diluar_tanggungan",
        perihal: "Surat Cuti Di Luar Tanggungan Perusahaan",
        applicantName: r.employee.fullName,
        applicantNumber: r.employee.employeeNumber,
        applicantPosition: r.employee.position.name,
        cityDateLabel: cityDateOf(r.createdAt),
        infoRows: [
          { label: "Tanggal Izin", value: `${formatDate(r.startDate)} — ${formatDate(r.endDate)}` },
          { label: "Alasan", value: r.reason },
        ],
        approvalColumns: buildApprovalColumns(r.approvalSteps),
        applicantColumn: applicantColumnOf(r.employee),
        noteWarning: null,
        attachments: r.supportingDocumentUrl
          ? [{ label: "Dokumen Pendukung", url: r.supportingDocumentUrl }]
          : [],
      })
    }
  }

  // Urutan hasil akhir ikut urutan `selections` (urutan baris yang dicentang
  // user), bukan urutan query per kind di atas.
  const letterheadUrl = await getIzinLetterheadUrl()
  return selections
    .map((s) => documentsByPublicId.get(s.publicId))
    .filter((d): d is Omit<IzinPrintDocument, "letterheadUrl"> => d !== undefined)
    .map((d) => ({ ...d, letterheadUrl }))
}

// Format "Surat Permohonan Cuti" resmi — dipakai untuk Cuti Tahunan >3 hari,
// Cuti Bersalin/Gugur Kandungan, Cuti Khusus (Haji/Umroh), dan Cuti Besar
// (lihat CutiFormalPrintDocument). Cuti Tahunan <=3 hari SENGAJA dilewati di
// sini (tetap dibangun IzinPrintDocument generik oleh getIzinPrintDocuments
// di atas) — pemanggil (route.tsx) yang menggabungkan: publicId yang tidak
// muncul di hasil fungsi ini otomatis fallback ke dokumen generik.
export async function getCutiFormalPrintDocuments(
  selections: IzinPrintSelection[]
): Promise<CutiFormalPrintDocument[]> {
  const idsByKind = new Map<CutiFormalKind, string[]>()
  for (const s of selections) {
    if (!CUTI_FORMAL_KINDS.has(s.kind as CutiFormalKind)) continue
    const kind = s.kind as CutiFormalKind
    idsByKind.set(kind, [...(idsByKind.get(kind) ?? []), s.publicId])
  }

  const documentsByPublicId = new Map<string, Omit<CutiFormalPrintDocument, "letterheadUrl">>()

  const cutiIds = idsByKind.get("cuti")
  if (cutiIds) {
    const rows = await prisma.cutiRequest.findMany({
      where: { publicId: { in: cutiIds } },
      include: {
        employee: { select: employeeContactSelect },
        substituteEmployee: { select: { fullName: true } },
        approvalSteps: { orderBy: { order: "asc" }, include: { approverEmployee: approverEmployeeSelect } },
      },
    })
    for (const r of rows) {
      const days = totalDaysBetween(r.startDate, r.endDate)
      if (days <= CUTI_DOCUMENT_REQUIRED_THRESHOLD_DAYS) continue // <=3 hari tetap pakai format generik

      const hrStep = r.approvalSteps.find((s) => s.approverType === "HR")
      const leaveConsumption = await getLeaveConsumptionSummary(r.employeeId, r.startDate.getFullYear())
      documentsByPublicId.set(r.publicId, {
        publicId: r.publicId,
        kind: "cuti",
        applicantName: r.employee.fullName,
        applicantNumber: r.employee.employeeNumber,
        applicantPosition: r.employee.position.name,
        submissionDateLabel: formatDateLong(r.createdAt),
        leaveTypeLabel: "Cuti Tahunan",
        durationLabel: durationLabelOf(days),
        startDateLabel: formatDate(r.startDate),
        endDateLabel: formatDate(r.endDate),
        applicantAddress: r.employee.address,
        applicantPhone: r.employee.phone,
        attachmentNote: r.supportingDocumentUrl
          ? "Berikut kami lampirkan dokumen pendukung untuk dapat dijadikan bahan pertimbangan."
          : null,
        cityDateLabel: cityDateOf(r.createdAt),
        signerName: hrStep?.approverEmployee?.fullName ?? null,
        signerSignatureUrl: hrStep?.approverEmployee?.signatureUrl ?? null,
        substitute: substituteOf(r.substituteEmployeeName, r.substituteEmployee?.fullName, r.approvalSteps),
        leaveConsumption,
        considerationColumns: buildConsiderationColumns(r.approvalSteps),
        attachments: r.supportingDocumentUrl
          ? [{ label: "Dokumen Pendukung", url: r.supportingDocumentUrl }]
          : [],
      })
    }
  }

  const maternityIds = idsByKind.get("cuti_bersalin")
  if (maternityIds) {
    const rows = await prisma.maternityLeaveRequest.findMany({
      where: { publicId: { in: maternityIds } },
      include: {
        employee: { select: employeeContactSelect },
        substituteEmployee: { select: { fullName: true } },
        approvalSteps: { orderBy: { order: "asc" }, include: { approverEmployee: approverEmployeeSelect } },
      },
    })
    for (const r of rows) {
      const days = totalDaysBetween(r.startDate, r.endDate)
      const hrStep = r.approvalSteps.find((s) => s.approverType === "HR")
      const leaveConsumption = await getLeaveConsumptionSummary(r.employeeId, r.startDate.getFullYear())
      documentsByPublicId.set(r.publicId, {
        publicId: r.publicId,
        kind: "cuti_bersalin",
        applicantName: r.employee.fullName,
        applicantNumber: r.employee.employeeNumber,
        applicantPosition: r.employee.position.name,
        submissionDateLabel: formatDateLong(r.createdAt),
        leaveTypeLabel: r.type === "BERSALIN" ? "Cuti Bersalin" : "Cuti Kandungan",
        durationLabel: durationLabelOf(days),
        startDateLabel: formatDate(r.startDate),
        endDateLabel: formatDate(r.endDate),
        applicantAddress: r.employee.address,
        applicantPhone: r.employee.phone,
        attachmentNote: "Berikut kami lampirkan surat keterangan dokter untuk dapat dijadikan bahan pertimbangan.",
        cityDateLabel: cityDateOf(r.createdAt),
        signerName: hrStep?.approverEmployee?.fullName ?? null,
        signerSignatureUrl: hrStep?.approverEmployee?.signatureUrl ?? null,
        substitute: substituteOf(r.substituteEmployeeName, r.substituteEmployee?.fullName, r.approvalSteps),
        leaveConsumption,
        considerationColumns: buildConsiderationColumns(r.approvalSteps),
        attachments: [{ label: "Dokumen Pendukung", url: r.supportingDocumentUrl }],
      })
    }
  }

  const specialLeaveIds = idsByKind.get("cuti_khusus")
  if (specialLeaveIds) {
    const rows = await prisma.specialLeaveRequest.findMany({
      where: { publicId: { in: specialLeaveIds } },
      include: {
        employee: { select: employeeContactSelect },
        substituteEmployee: { select: { fullName: true } },
        approvalSteps: { orderBy: { order: "asc" }, include: { approverEmployee: approverEmployeeSelect } },
      },
    })
    for (const r of rows) {
      const days = totalDaysBetween(r.startDate, r.endDate)
      const hrStep = r.approvalSteps.find((s) => s.approverType === "HR")
      const leaveConsumption = await getLeaveConsumptionSummary(r.employeeId, r.startDate.getFullYear())
      documentsByPublicId.set(r.publicId, {
        publicId: r.publicId,
        kind: "cuti_khusus",
        applicantName: r.employee.fullName,
        applicantNumber: r.employee.employeeNumber,
        applicantPosition: r.employee.position.name,
        submissionDateLabel: formatDateLong(r.createdAt),
        leaveTypeLabel: r.type === "HAJI" ? "Cuti Khusus (Haji)" : "Cuti Khusus (Umroh)",
        durationLabel: durationLabelOf(days),
        startDateLabel: formatDate(r.startDate),
        endDateLabel: formatDate(r.endDate),
        applicantAddress: r.employee.address,
        applicantPhone: r.employee.phone,
        attachmentNote: "Berikut kami lampirkan bukti pendaftaran untuk dapat dijadikan bahan pertimbangan.",
        cityDateLabel: cityDateOf(r.createdAt),
        signerName: hrStep?.approverEmployee?.fullName ?? null,
        signerSignatureUrl: hrStep?.approverEmployee?.signatureUrl ?? null,
        substitute: substituteOf(r.substituteEmployeeName, r.substituteEmployee?.fullName, r.approvalSteps),
        leaveConsumption,
        considerationColumns: buildConsiderationColumns(r.approvalSteps),
        attachments: [{ label: "Bukti Pendaftaran", url: r.supportingDocumentUrl }],
      })
    }
  }

  const cutiBesarIds = idsByKind.get("cuti_besar")
  if (cutiBesarIds) {
    const rows = await prisma.cutiBesarRequest.findMany({
      where: { publicId: { in: cutiBesarIds } },
      include: {
        employee: { select: employeeContactSelect },
        substituteEmployee: { select: { fullName: true } },
        approvalSteps: { orderBy: { order: "asc" }, include: { approverEmployee: approverEmployeeSelect } },
      },
    })
    for (const r of rows) {
      const days = totalDaysBetween(r.startDate, r.endDate)
      const hrStep = r.approvalSteps.find((s) => s.approverType === "HR")
      const leaveConsumption = await getLeaveConsumptionSummary(r.employeeId, r.startDate.getFullYear())
      documentsByPublicId.set(r.publicId, {
        publicId: r.publicId,
        kind: "cuti_besar",
        applicantName: r.employee.fullName,
        applicantNumber: r.employee.employeeNumber,
        applicantPosition: r.employee.position.name,
        submissionDateLabel: formatDateLong(r.createdAt),
        leaveTypeLabel: "Cuti Besar",
        durationLabel: durationLabelOf(days),
        startDateLabel: formatDate(r.startDate),
        endDateLabel: formatDate(r.endDate),
        applicantAddress: r.employee.address,
        applicantPhone: r.employee.phone,
        attachmentNote: r.supportingDocumentUrl
          ? "Berikut kami lampirkan dokumen pendukung untuk dapat dijadikan bahan pertimbangan."
          : null,
        cityDateLabel: cityDateOf(r.createdAt),
        signerName: hrStep?.approverEmployee?.fullName ?? null,
        signerSignatureUrl: hrStep?.approverEmployee?.signatureUrl ?? null,
        substitute: substituteOf(r.substituteEmployeeName, r.substituteEmployee?.fullName, r.approvalSteps),
        leaveConsumption,
        considerationColumns: buildConsiderationColumns(r.approvalSteps),
        attachments: r.supportingDocumentUrl
          ? [{ label: "Dokumen Pendukung", url: r.supportingDocumentUrl }]
          : [],
      })
    }
  }

  const letterheadUrl = await getIzinLetterheadUrl()
  return selections
    .map((s) => documentsByPublicId.get(s.publicId))
    .filter((d): d is Omit<CutiFormalPrintDocument, "letterheadUrl"> => d !== undefined)
    .map((d) => ({ ...d, letterheadUrl }))
}

// Format cetak khusus buat Izin Lembur ("Surat Perintah Lembur") — beda
// struktur dari format generik di atas: bukan tabel info + kolom approval
// diakhiri Pemohon, tapi blok teks "Yang Bertandatangan..."/"Menunjuk
// Kepada" lalu 4 kolom tanda tangan diawali Pemohon (Dibuat/Pemohon, Kabag
// Ybs, Mengetahui & Menyetujui/Personalia, Direksi).
export type OvertimePrintDocument = {
  publicId: string
  // "Yang Bertandatangan di bawah ini" — Kepala Departemen pemohon (yang
  // menerbitkan/mengizinkan surat lembur), BUKAN atasan langsung. Nama
  // field dipertahankan "supervisor*" biar tidak mengubah kontrak dengan
  // izin-print-pdf.tsx/route.tsx, tapi isinya sekarang Kepala Departemen.
  supervisorName: string
  supervisorPosition: string
  applicantName: string
  applicantPosition: string
  tanggal: string
  pukul: string
  tempat: string
  kegiatan: string
  keteranganLembur: string
  cityDateLabel: string
  columns: ApprovalColumnPrint[]
  attachments: { label: string; url: string }[]
  letterheadUrl: string | null
}

// Label kolom tanda tangan versi Surat Perintah Lembur — beda dari label
// approval biasa (mis. HR jadi "Mengetahui & Menyetujui" / "Personalia").
// Tipe approver yang tidak ada di sini (mis. Kepala Departemen, Pegawai
// Tertentu — kalau Alur Approval Lembur dikonfigurasi pakai itu) fallback
// ke APPROVER_TYPE_LABEL biasa.
const OVERTIME_COLUMN_LABEL: Partial<Record<ApproverType, { label: string; sublabel?: string }>> = {
  ATASAN_LANGSUNG: { label: "Kabag Ybs" },
  HR: { label: "Mengetahui & Menyetujui", sublabel: "Personalia" },
  DIREKSI: { label: "Direksi" },
}

function formatTime12h(hhmm: string | null): string | null {
  if (!hhmm) return null
  const [hStr, mStr] = hhmm.split(":")
  const h = Number(hStr)
  const period = h >= 12 ? "PM" : "AM"
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${mStr} ${period}`
}

export async function getOvertimePrintDocuments(
  publicIds: string[]
): Promise<OvertimePrintDocument[]> {
  if (publicIds.length === 0) return []

  const rows = await prisma.overtimeRequest.findMany({
    where: { publicId: { in: publicIds } },
    include: {
      employee: {
        select: {
          ...employeeSelect,
          // "Yang Bertandatangan di bawah ini" di Surat Perintah Lembur
          // HARUS Kepala Departemen (Department.headEmployeeId) — dialah
          // yang memberi izin/menerbitkan surat lembur, BUKAN atasan
          // langsung pemohon (Employee.reportsToId, bisa jadi orang
          // berbeda, mis. kasi/koordinator tim).
          department: {
            select: {
              headEmployee: { select: { fullName: true, position: { select: { name: true } } } },
            },
          },
        },
      },
      approvalSteps: { orderBy: { order: "asc" }, include: { approverEmployee: approverEmployeeSelect } },
      proofs: { orderBy: { id: "asc" } },
    },
  })

  const documentsByPublicId = new Map<string, Omit<OvertimePrintDocument, "letterheadUrl">>()
  for (const r of rows) {
    const columns: ApprovalColumnPrint[] = [
      {
        label: "Dibuat",
        sublabel: "Pemohon,",
        status: "APPROVED",
        signerName: r.employee.fullName,
        signatureUrl: r.employee.signatureUrl,
        actedAt: null,
      },
      ...r.approvalSteps
        .filter((s) => s.status !== "SKIPPED")
        .map((s): ApprovalColumnPrint => {
          const override = OVERTIME_COLUMN_LABEL[s.approverType]
          return {
            label: override?.label ?? APPROVER_TYPE_LABEL[s.approverType],
            sublabel: override?.sublabel,
            status: s.status as ApprovalColumnPrint["status"],
            signerName: s.approverEmployee?.fullName ?? null,
            signatureUrl: s.approverEmployee?.signatureUrl ?? null,
            actedAt: s.actedAt ? formatDateTime(s.actedAt) : null,
          }
        }),
    ]

    const pukulStart = formatTime12h(r.actualStartTime)
    const pukulEnd = formatTime12h(r.actualEndTime)

    documentsByPublicId.set(r.publicId, {
      publicId: r.publicId,
      supervisorName: r.employee.department.headEmployee?.fullName ?? "-",
      supervisorPosition: r.employee.department.headEmployee?.position.name ?? "-",
      applicantName: r.employee.fullName,
      applicantPosition: r.employee.position.name,
      tanggal: formatDate(r.date),
      pukul: pukulStart && pukulEnd ? `${pukulStart} - ${pukulEnd}` : "-",
      tempat: r.locationLabel ?? "-",
      kegiatan: r.task,
      keteranganLembur: r.resultDescription ?? "-",
      cityDateLabel: cityDateOf(r.date),
      columns,
      attachments: r.proofs.map((p) => ({ label: "Bukti Lembur", url: p.url })),
    })
  }

  const letterheadUrl = await getIzinLetterheadUrl()
  return publicIds
    .map((id) => documentsByPublicId.get(id))
    .filter((d): d is Omit<OvertimePrintDocument, "letterheadUrl"> => d !== undefined)
    .map((d) => ({ ...d, letterheadUrl }))
}
