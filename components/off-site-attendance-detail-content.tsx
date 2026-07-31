import Link from "next/link"
import {
  CheckCircle2,
  ChevronLeft,
  Clock,
  FileText,
  MapPin,
  User,
  XCircle,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ApprovalTimeline, type ApprovalStepRow } from "@/components/approval-timeline"
import { FileAttachmentPreview } from "@/components/file-attachment-preview"
import { MapLink } from "@/components/map-link"

export type OffSiteAttendanceDetailData = {
  id: number
  publicId: string
  applicant: string
  date: string
  location: string
  reason: string
  evidenceUrl: string | null
  // Hasil resolusi GPS browser saat pengajuan dibuat, buat cross-check
  // terhadap isian manual `location` di atas — null kalau browser menolak
  // izin lokasi. Lihat lib/geo.ts.
  gpsLocationLabel: string | null
  gpsLat: number | null
  gpsLng: number | null
  status: "PENDING_APPROVAL" | "APPROVED" | "REJECTED"
  rejectionReason: string | null
  createdAt: string
  steps: ApprovalStepRow[]
}

export type OffSiteAttendanceDetailBasePath = "/admin" | "/pegawai"

const STATUS_LABEL: Record<OffSiteAttendanceDetailData["status"], string> = {
  PENDING_APPROVAL: "Menunggu Approval",
  APPROVED: "Disetujui",
  REJECTED: "Ditolak",
}

const STATUS_VARIANT: Record<
  OffSiteAttendanceDetailData["status"],
  "default" | "secondary" | "destructive" | "outline"
> = {
  PENDING_APPROVAL: "secondary",
  APPROVED: "default",
  REJECTED: "destructive",
}

const STATUS_HEADER_STYLE: Record<
  OffSiteAttendanceDetailData["status"],
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

export function OffSiteAttendanceDetailContent({
  data,
  basePath,
}: {
  data: OffSiteAttendanceDetailData
  basePath: OffSiteAttendanceDetailBasePath
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
                  <CardTitle>Detail Izin Absen Diluar Kantor</CardTitle>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Pengajuan {data.publicId}
                  </p>
                </div>
              </div>
              <Badge variant={STATUS_VARIANT[data.status]}>{STATUS_LABEL[data.status]}</Badge>
            </CardHeader>

            <CardContent className="grid gap-x-6 gap-y-4 pt-4 sm:grid-cols-2">
              <Field icon={User} label="Pemohon" value={data.applicant} />
              <Field icon={Clock} label="Tanggal" value={data.date} />
              <Field icon={MapPin} label="Lokasi Kerja di Luar Kantor" value={data.location} />
              <Field icon={FileText} label="Diajukan" value={data.createdAt} />
              {data.gpsLocationLabel ? (
                <div>
                  <Field
                    icon={MapPin}
                    label="Lokasi GPS Saat Mengajukan"
                    value={data.gpsLocationLabel}
                  />
                  <div className="mt-1">
                    <MapLink lat={data.gpsLat} lng={data.gpsLng} />
                  </div>
                </div>
              ) : null}
              <div className="sm:col-span-2">
                <Field icon={FileText} label="Keperluan" value={data.reason} />
              </div>
              {data.evidenceUrl ? (
                <div>
                  <p className="text-xs text-muted-foreground">Bukti Pendukung</p>
                  <div className="mt-0.5">
                    <FileAttachmentPreview url={data.evidenceUrl} label="Lihat Bukti" />
                  </div>
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
