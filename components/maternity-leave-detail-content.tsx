import Link from "next/link"
import {
  Baby,
  CheckCircle2,
  ChevronLeft,
  Clock,
  FileText,
  RotateCcw,
  User,
  Users,
  XCircle,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ApprovalTimeline, type ApprovalStepRow } from "@/components/approval-timeline"
import { MaternityLeaveResubmitForm } from "@/components/maternity-leave-resubmit-form"
import { FileAttachmentPreview } from "@/components/file-attachment-preview"

export type MaternityLeaveDetailData = {
  id: number
  publicId: string
  applicant: string
  type: "BERSALIN" | "GUGUR_KANDUNGAN"
  referenceDate: string
  startDate: string
  endDate: string
  beforeRangeStart: string | null
  beforeRangeEnd: string | null
  afterRangeStart: string
  afterRangeEnd: string
  totalDays: number
  reason: string | null
  substituteEmployeeName: string | null
  supportingDocumentUrl: string
  status: "PENDING_APPROVAL" | "APPROVED" | "REJECTED" | "REVISI"
  rejectionReason: string | null
  approvedAt: string | null
  createdAt: string
  isOwner: boolean
  steps: ApprovalStepRow[]
}

export type MaternityLeaveDetailBasePath = "/admin" | "/pegawai"

const TYPE_LABEL: Record<MaternityLeaveDetailData["type"], string> = {
  BERSALIN: "Cuti Bersalin",
  GUGUR_KANDUNGAN: "Cuti Gugur Kandungan",
}

const STATUS_LABEL: Record<MaternityLeaveDetailData["status"], string> = {
  PENDING_APPROVAL: "Menunggu Approval",
  APPROVED: "Disetujui",
  REJECTED: "Ditolak",
  REVISI: "Menunggu Revisi",
}

const STATUS_VARIANT: Record<
  MaternityLeaveDetailData["status"],
  "default" | "secondary" | "destructive" | "outline"
> = {
  PENDING_APPROVAL: "secondary",
  APPROVED: "default",
  REJECTED: "destructive",
  REVISI: "secondary",
}

const STATUS_HEADER_STYLE: Record<
  MaternityLeaveDetailData["status"],
  { header: string; icon: string; Icon: typeof Clock }
> = {
  PENDING_APPROVAL: {
    header: "bg-amber-50 dark:bg-amber-500/10",
    icon: "bg-amber-500",
    Icon: Clock,
  },
  APPROVED: {
    header: "bg-emerald-50 dark:bg-emerald-500/10",
    icon: "bg-emerald-600",
    Icon: CheckCircle2,
  },
  REJECTED: {
    header: "bg-red-50 dark:bg-red-500/10",
    icon: "bg-red-600",
    Icon: XCircle,
  },
  REVISI: {
    header: "bg-amber-50 dark:bg-amber-500/10",
    icon: "bg-amber-500",
    Icon: RotateCcw,
  },
}

function Field({
  icon: Icon,
  label,
  value,
}: {
  icon?: typeof Clock
  label: string
  value: string
}) {
  return (
    <div className="min-w-0">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {Icon ? <Icon className="size-3.5" /> : null}
        {label}
      </p>
      <p className="mt-0.5 text-sm font-medium break-words">{value}</p>
    </div>
  )
}

export function MaternityLeaveDetailContent({
  data,
  basePath,
  substituteColleagues,
}: {
  data: MaternityLeaveDetailData
  basePath: MaternityLeaveDetailBasePath
  substituteColleagues: { id: number; fullName: string; position: { name: string } }[]
}) {
  const headerStyle = STATUS_HEADER_STYLE[data.status]
  const HeaderIcon = headerStyle.Icon
  const visibleSteps = data.steps
    .filter((step) => step.status !== "SKIPPED")
    .map((step, index) => ({ ...step, order: index + 1 }))

  return (
    <div className="grid gap-4">
      <Link
        href={`${basePath}/riwayat-izin`}
        className="inline-flex w-fit items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline"
      >
        <ChevronLeft className="size-4" />
        Kembali ke daftar
      </Link>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="grid gap-6 lg:col-span-2">
          <Card className="overflow-hidden">
            <CardHeader
              className={cn(
                "-mt-(--card-spacing) flex items-start justify-between gap-2 rounded-t-xl border-b py-4",
                headerStyle.header
              )}
            >
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-full text-white",
                    headerStyle.icon
                  )}
                >
                  <HeaderIcon className="size-4.5" />
                </span>
                <div>
                  <CardTitle>Detail {TYPE_LABEL[data.type]}</CardTitle>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Pengajuan {data.publicId}
                  </p>
                </div>
              </div>
              <Badge variant={STATUS_VARIANT[data.status]}>{STATUS_LABEL[data.status]}</Badge>
            </CardHeader>

            <CardContent className="grid gap-x-6 gap-y-4 pt-4 sm:grid-cols-2">
              <Field icon={User} label="Pemohon" value={data.applicant} />
              {data.substituteEmployeeName ? (
                <Field icon={Users} label="Pegawai Pengganti" value={data.substituteEmployeeName} />
              ) : null}
              <Field icon={FileText} label="Diajukan" value={data.createdAt} />
              {data.reason ? (
                <Field icon={FileText} label="Keterangan" value={data.reason} />
              ) : null}
            </CardContent>

            <CardContent className="border-t pt-4">
              <p className="mb-3 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Baby className="size-3.5" />
                Rincian Perhitungan Cuti (Pasal 37)
              </p>
              <div className="grid gap-x-6 gap-y-4 sm:grid-cols-3">
                <Field
                  label={data.type === "BERSALIN" ? "Tanggal HPL" : "Tanggal Kejadian"}
                  value={data.referenceDate}
                />
                {data.beforeRangeStart && data.beforeRangeEnd ? (
                  <Field
                    label="1,5 Bulan Sebelum HPL"
                    value={`${data.beforeRangeStart} — ${data.beforeRangeEnd}`}
                  />
                ) : null}
                <Field
                  label={data.type === "BERSALIN" ? "1,5 Bulan Setelah HPL" : "1,5 Bulan Setelahnya"}
                  value={`${data.afterRangeStart} — ${data.afterRangeEnd}`}
                />
              </div>
              <div className="mt-4 border-t pt-3">
                <p className="text-xs text-muted-foreground">Total Cuti</p>
                <p className="mt-0.5 text-sm font-semibold">{data.totalDays} hari</p>
              </div>
            </CardContent>

            {data.status === "REJECTED" && data.rejectionReason ? (
              <CardContent className="border-t pt-4">
                <div className="border-l-2 border-destructive pl-3">
                  <p className="text-xs text-muted-foreground">Alasan Ditolak</p>
                  <p className="mt-0.5 text-sm">{data.rejectionReason}</p>
                </div>
              </CardContent>
            ) : null}

            {data.status === "REVISI" ? (
              <CardContent className="border-t pt-4">
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-500/20 dark:bg-amber-500/10">
                  <p className="text-sm font-medium text-amber-900 dark:text-amber-300">
                    Pegawai pengganti sebelumnya tidak bersedia
                  </p>
                  <p className="mt-0.5 text-xs text-amber-800/80 dark:text-amber-300/70">
                    Lihat catatan di Progres Alur Approval untuk alasannya. Silakan pilih
                    pengganti baru di bawah — pengajuan akan lanjut dari step ini juga,
                    tidak perlu mulai dari awal.
                  </p>
                  {data.isOwner ? (
                    <div className="mt-3">
                      <MaternityLeaveResubmitForm
                        requestId={data.id}
                        colleagues={substituteColleagues}
                      />
                    </div>
                  ) : null}
                </div>
              </CardContent>
            ) : null}

            <CardContent className="border-t pt-4">
              <p className="text-xs text-muted-foreground">Surat Keterangan Dokter</p>
              <FileAttachmentPreview url={data.supportingDocumentUrl} label="Lihat Surat" />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="border-b">
            <CardTitle>Progres Alur Approval</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="lg:sticky lg:top-6">
              <ApprovalTimeline
                steps={visibleSteps}
                submittedAt={data.createdAt}
                finalStatus={
                  data.status === "REJECTED"
                    ? "REJECTED"
                    : data.status === "APPROVED"
                      ? "APPROVED"
                      : "PENDING"
                }
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
