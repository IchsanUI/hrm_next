import Link from "next/link"
import {
  Briefcase,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  Clock,
  MapPin,
  User,
  XCircle,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ApprovalTimeline, type ApprovalStepRow } from "@/components/approval-timeline"
import { OvertimeCompleteForm } from "@/components/overtime-complete-form"
import { FileAttachmentPreview } from "@/components/file-attachment-preview"

export type OvertimeDetailData = {
  id: number
  publicId: string
  applicant: string
  date: string
  task: string
  status: "PENDING_APPROVAL" | "APPROVED" | "REJECTED" | "COMPLETED"
  rejectionReason: string | null
  actualStartTime: string | null
  actualEndTime: string | null
  actualHours: number | null
  resultDescription: string | null
  proofUrls: string[]
  completedAt: string | null
  locationLabel: string | null
  isOwner: boolean
  steps: ApprovalStepRow[]
}

export type OvertimeDetailBasePath = "/admin" | "/pegawai"

const STATUS_LABEL: Record<OvertimeDetailData["status"], string> = {
  PENDING_APPROVAL: "Menunggu Approval",
  APPROVED: "Disetujui",
  REJECTED: "Ditolak",
  COMPLETED: "Selesai",
}

const STATUS_VARIANT: Record<
  OvertimeDetailData["status"],
  "default" | "secondary" | "destructive" | "outline"
> = {
  PENDING_APPROVAL: "secondary",
  APPROVED: "default",
  REJECTED: "destructive",
  COMPLETED: "outline",
}

// Warna datar (bukan gradasi) per status, dipakai buat header kartu supaya
// tidak polos tapi tetap tenang — satu warna solid, bukan blend.
const STATUS_HEADER_STYLE: Record<
  OvertimeDetailData["status"],
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
  COMPLETED: {
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

export function OvertimeDetailContent({
  data,
  basePath,
}: {
  data: OvertimeDetailData
  basePath: OvertimeDetailBasePath
}) {
  const jamAktual =
    data.actualStartTime && data.actualEndTime
      ? `${data.actualStartTime} — ${data.actualEndTime} (${data.actualHours ?? "-"} jam)`
      : "-"
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
                <CardTitle>Detail Izin Lembur</CardTitle>
                <p className="mt-0.5 text-xs text-muted-foreground">Pengajuan {data.publicId}</p>
              </div>
            </div>
            <Badge variant={STATUS_VARIANT[data.status]}>{STATUS_LABEL[data.status]}</Badge>
          </CardHeader>

          <CardContent className="grid gap-x-6 gap-y-4 pt-4 sm:grid-cols-2">
            <Field icon={User} label="Pemohon" value={data.applicant} />
            <Field icon={Calendar} label="Tanggal Lembur" value={data.date} />
            <div className="sm:col-span-2">
              <Field icon={Briefcase} label="Tugas Lembur" value={data.task} />
            </div>
            {data.locationLabel ? (
              <div className="sm:col-span-2">
                <Field icon={MapPin} label="Lokasi Saat Mengajukan" value={data.locationLabel} />
              </div>
            ) : null}
          </CardContent>

          {data.status === "REJECTED" && data.rejectionReason ? (
            <CardContent className="border-t pt-4">
              <div className="border-l-2 border-destructive pl-3">
                <p className="text-xs text-muted-foreground">Alasan Ditolak</p>
                <p className="mt-0.5 text-sm">{data.rejectionReason}</p>
              </div>
            </CardContent>
          ) : null}

          {data.status === "COMPLETED" ? (
            <CardContent className="grid gap-x-6 gap-y-4 border-t pt-4 sm:grid-cols-2">
              <Field icon={Clock} label="Jam Aktual Lembur" value={jamAktual} />
              <Field label="Selesai Dilengkapi" value={data.completedAt ?? "-"} />
              {data.resultDescription ? (
                <div className="sm:col-span-2">
                  <Field label="Deskripsi Hasil Lembur" value={data.resultDescription} />
                </div>
              ) : null}
              {data.proofUrls.length > 0 ? (
                <div className="sm:col-span-2">
                  <p className="text-xs text-muted-foreground">Bukti Lembur</p>
                  <div className="mt-0.5 flex flex-wrap gap-3">
                    {data.proofUrls.map((url, index) => (
                      <FileAttachmentPreview
                        key={url}
                        url={url}
                        label={`Lihat Bukti ${data.proofUrls.length > 1 ? index + 1 : ""}`.trim()}
                      />
                    ))}
                  </div>
                </div>
              ) : null}
            </CardContent>
          ) : null}
        </Card>

        {data.status === "APPROVED" && data.isOwner ? (
          <OvertimeCompleteForm requestId={data.id} />
        ) : null}
      </div>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Progres Alur Approval</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="lg:sticky lg:top-6">
            <ApprovalTimeline
              steps={data.steps}
              finalStatus={
                data.status === "REJECTED"
                  ? "REJECTED"
                  : data.status === "APPROVED" || data.status === "COMPLETED"
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
