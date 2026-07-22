import Link from "next/link"
import { CheckCircle2, ChevronLeft, Clock, FileText, ShieldCheck, User, XCircle } from "lucide-react"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ApprovalTimeline, type ApprovalStepRow } from "@/components/approval-timeline"
import { ATTENDANCE_STATEMENT_ACKNOWLEDGEMENTS } from "@/lib/validations/attendance-statement"

export type AttendanceStatementDetailData = {
  id: number
  publicId: string
  applicant: string
  date: string
  missedTypeLabel: string
  reason: string
  status: "PENDING_APPROVAL" | "APPROVED" | "REJECTED"
  rejectionReason: string | null
  createdAt: string
  steps: ApprovalStepRow[]
}

export type AttendanceStatementDetailBasePath = "/admin" | "/pegawai"

const STATUS_LABEL: Record<AttendanceStatementDetailData["status"], string> = {
  PENDING_APPROVAL: "Menunggu Approval",
  APPROVED: "Disetujui",
  REJECTED: "Ditolak",
}

const STATUS_VARIANT: Record<
  AttendanceStatementDetailData["status"],
  "default" | "secondary" | "destructive" | "outline"
> = {
  PENDING_APPROVAL: "secondary",
  APPROVED: "default",
  REJECTED: "destructive",
}

const STATUS_HEADER_STYLE: Record<
  AttendanceStatementDetailData["status"],
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

export function AttendanceStatementDetailContent({
  data,
  basePath,
}: {
  data: AttendanceStatementDetailData
  basePath: AttendanceStatementDetailBasePath
}) {
  const headerStyle = STATUS_HEADER_STYLE[data.status]
  const HeaderIcon = headerStyle.Icon

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
                  <CardTitle>Detail Pernyataan Tidak Absen</CardTitle>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Pengajuan {data.publicId}
                  </p>
                </div>
              </div>
              <Badge variant={STATUS_VARIANT[data.status]}>{STATUS_LABEL[data.status]}</Badge>
            </CardHeader>

            <CardContent className="grid gap-x-6 gap-y-4 pt-4 sm:grid-cols-2">
              <Field icon={User} label="Pemohon" value={data.applicant} />
              <Field icon={Clock} label="Tanggal Kejadian" value={data.date} />
              <Field icon={FileText} label="Jenis" value={data.missedTypeLabel} />
              <Field icon={FileText} label="Diajukan" value={data.createdAt} />
              <div className="sm:col-span-2">
                <Field icon={FileText} label="Alasan" value={data.reason} />
              </div>
            </CardContent>

            <CardContent className="border-t pt-4">
              <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300">
                <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
                <div className="grid gap-1.5">
                  <p className="font-medium">Pernyataan yang dicentang pemohon:</p>
                  <ul className="grid list-disc gap-1 pl-4">
                    {ATTENDANCE_STATEMENT_ACKNOWLEDGEMENTS.map((ack) => (
                      <li key={ack.field}>{ack.label}</li>
                    ))}
                  </ul>
                </div>
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
          </Card>
        </div>

        <Card>
          <CardHeader className="border-b">
            <CardTitle>Progres Alur Approval</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="lg:sticky lg:top-6">
              <ApprovalTimeline
                steps={data.steps}
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
