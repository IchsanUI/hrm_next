import Link from "next/link"
import {
  CheckCircle2,
  ChevronLeft,
  Clock,
  FileText,
  LogOut,
  Tag,
  User,
  XCircle,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ApprovalTimeline, type ApprovalStepRow } from "@/components/approval-timeline"

export type OfficeExitDetailData = {
  id: number
  publicId: string
  applicant: string
  plannedExitTime: string
  category: "PRIBADI" | "DINAS"
  reason: string
  status: "PENDING_APPROVAL" | "APPROVED" | "REJECTED"
  rejectionReason: string | null
  approvedAt: string | null
  createdAt: string
  steps: ApprovalStepRow[]
}

export type OfficeExitDetailBasePath = "/admin" | "/pegawai"

const STATUS_LABEL: Record<OfficeExitDetailData["status"], string> = {
  PENDING_APPROVAL: "Menunggu Approval",
  APPROVED: "Disetujui",
  REJECTED: "Ditolak",
}

const STATUS_VARIANT: Record<
  OfficeExitDetailData["status"],
  "default" | "secondary" | "destructive" | "outline"
> = {
  PENDING_APPROVAL: "secondary",
  APPROVED: "default",
  REJECTED: "destructive",
}

// Warna datar (bukan gradasi) per status, dipakai buat header kartu supaya
// tidak polos tapi tetap tenang — satu warna solid, bukan blend.
const STATUS_HEADER_STYLE: Record<
  OfficeExitDetailData["status"],
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

const CATEGORY_LABEL: Record<OfficeExitDetailData["category"], string> = {
  PRIBADI: "Urusan Pribadi",
  DINAS: "Urusan Dinas",
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

export function OfficeExitDetailContent({
  data,
  basePath,
}: {
  data: OfficeExitDetailData
  basePath: OfficeExitDetailBasePath
}) {
  // Alur izin ini asimetris — Kepala Departemen dan Direksi tidak pernah
  // sama-sama aktif untuk satu pengajuan (lihat catatan di Alur Approval),
  // jadi step yang di-skip cuma bikin ramai tanpa informasi baru. Step yang
  // benar-benar jalan dinomori ulang biar urutannya tetap rapi (mis. kalau
  // yang aktif cuma Direksi, tampil sebagai "Step 1", bukan "Step 2").
  const visibleSteps = data.steps
    .filter((step) => step.status !== "SKIPPED")
    .map((step, index) => ({ ...step, order: index + 1 }))
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
                  <CardTitle>Detail Izin Meninggalkan Kantor</CardTitle>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Pengajuan {data.publicId}
                  </p>
                </div>
              </div>
              <Badge variant={STATUS_VARIANT[data.status]}>{STATUS_LABEL[data.status]}</Badge>
            </CardHeader>

            <CardContent className="grid gap-x-6 gap-y-4 pt-4 sm:grid-cols-2">
              <Field icon={User} label="Pemohon" value={data.applicant} />
              <Field icon={Clock} label="Rencana Jam Keluar" value={data.plannedExitTime} />
              <Field icon={Tag} label="Kategori" value={CATEGORY_LABEL[data.category]} />
              <Field icon={FileText} label="Diajukan" value={data.createdAt} />
              <div className="sm:col-span-2">
                <Field icon={FileText} label="Penjelasan Keluar" value={data.reason} />
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

            {data.status === "APPROVED" ? (
              <CardContent className="border-t pt-4">
                <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-500/20 dark:bg-emerald-500/10">
                  <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
                    <LogOut className="size-4" />
                  </span>
                  <div>
                    <p className="text-sm font-medium text-emerald-900 dark:text-emerald-300">
                      Anda diperbolehkan meninggalkan kantor
                    </p>
                    <p className="mt-0.5 text-xs text-emerald-800/80 dark:text-emerald-300/70">
                      Disetujui {data.approvedAt ?? "-"}
                    </p>
                  </div>
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
