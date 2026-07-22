import { prisma } from "@/lib/prisma"
import { DISPENSATION_CATEGORY_LABEL } from "@/lib/validations/dispensation"
import { computeMaternityLeaveBreakdown } from "@/lib/validations/maternity-leave"
import { OFFICE_EXIT_CATEGORY_LABEL, type IzinMonitoringRow } from "@/lib/izin-monitoring"
import { IZIN_MONITORING_KIND_OPTIONS } from "@/lib/izin-monitoring-constants"
import { APPROVER_TYPE_LABEL, type ApproverType } from "@/lib/approval-step-labels"

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
}

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

const employeeSelect = {
  fullName: true,
  employeeNumber: true,
  signatureUrl: true,
  position: { select: { name: true } },
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

  const documentsByPublicId = new Map<string, IzinPrintDocument>()

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
  return selections
    .map((s) => documentsByPublicId.get(s.publicId))
    .filter((d): d is IzinPrintDocument => d !== undefined)
}

// Format cetak khusus buat Izin Lembur ("Surat Perintah Lembur") — beda
// struktur dari format generik di atas: bukan tabel info + kolom approval
// diakhiri Pemohon, tapi blok teks "Yang Bertandatangan..."/"Menunjuk
// Kepada" lalu 4 kolom tanda tangan diawali Pemohon (Dibuat/Pemohon, Kabag
// Ybs, Mengetahui & Menyetujui/Personalia, Direksi).
export type OvertimePrintDocument = {
  publicId: string
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
          reportsTo: { select: { fullName: true, position: { select: { name: true } } } },
        },
      },
      approvalSteps: { orderBy: { order: "asc" }, include: { approverEmployee: approverEmployeeSelect } },
      proofs: { orderBy: { id: "asc" } },
    },
  })

  const documentsByPublicId = new Map<string, OvertimePrintDocument>()
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
      supervisorName: r.employee.reportsTo?.fullName ?? "-",
      supervisorPosition: r.employee.reportsTo?.position.name ?? "-",
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

  return publicIds
    .map((id) => documentsByPublicId.get(id))
    .filter((d): d is OvertimePrintDocument => d !== undefined)
}
