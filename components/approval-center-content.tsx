"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import type { ColumnDef } from "@tanstack/react-table"
import { toast } from "sonner"
import { Clock, CheckCircle2, XCircle, Eye } from "lucide-react"

import { approveOvertimeRequestAction, rejectOvertimeRequestAction } from "@/server/actions/overtime"
import {
  approveOfficeExitRequestAction,
  rejectOfficeExitRequestAction,
} from "@/server/actions/office-exit"
import {
  approveEarlyLeaveRequestAction,
  rejectEarlyLeaveRequestAction,
} from "@/server/actions/early-leave"
import {
  approveLateArrivalRequestAction,
  rejectLateArrivalRequestAction,
} from "@/server/actions/late-arrival"
import {
  approveSickLeaveRequestAction,
  rejectSickLeaveRequestAction,
  reviseSickLeaveRequestAction,
} from "@/server/actions/sick-leave"
import {
  approveCutiRequestAction,
  rejectCutiRequestAction,
  reviseCutiRequestAction,
} from "@/server/actions/cuti"
import {
  approveMaternityLeaveRequestAction,
  rejectMaternityLeaveRequestAction,
  reviseMaternityLeaveRequestAction,
} from "@/server/actions/maternity-leave"
import {
  approveSpecialLeaveRequestAction,
  rejectSpecialLeaveRequestAction,
  reviseSpecialLeaveRequestAction,
} from "@/server/actions/special-leave"
import {
  approveDispensationRequestAction,
  rejectDispensationRequestAction,
  reviseDispensationRequestAction,
} from "@/server/actions/dispensation"
import {
  approveCutiBesarRequestAction,
  rejectCutiBesarRequestAction,
  reviseCutiBesarRequestAction,
} from "@/server/actions/cuti-besar"
import {
  approveUnpaidLeaveRequestAction,
  rejectUnpaidLeaveRequestAction,
  reviseUnpaidLeaveRequestAction,
} from "@/server/actions/unpaid-leave"
import {
  approveOffSiteAttendanceRequestAction,
  rejectOffSiteAttendanceRequestAction,
} from "@/server/actions/off-site-attendance"
import {
  approveAttendanceStatementRequestAction,
  rejectAttendanceStatementRequestAction,
} from "@/server/actions/attendance-statement"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DataTable } from "@/components/data-table"
import { RejectDialog } from "@/components/reject-dialog"
import { Tabs, TabsList, TabsTrigger, TabsPanel } from "@/components/ui/tabs"
import type { ApproverType } from "@/lib/approval-step-labels"

// yyyy-mm-dd (waktu lokal) buat default value date-range filter — dicocokkan
// sama ApprovalQueueRow/ApprovalHistoryRow.dateValue yang dihitung di server.
function todayDateValue() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export type ApprovalQueueRow = {
  id: number
  publicId: string
  kind:
    | "lembur"
    | "meninggalkan_kantor"
    | "pulang_cepat"
    | "terlambat"
    | "sakit"
    | "cuti"
    | "cuti_bersalin"
    | "cuti_khusus"
    | "dispensasi"
    | "cuti_besar"
    | "cuti_diluar_tanggungan"
    | "absen_luar_kantor"
    | "tidak_absen"
  applicant: string
  type: string
  date: string
  // yyyy-mm-dd (waktu lokal) dari tanggal pengajuan — dipakai buat filter
  // rentang tanggal, terpisah dari "date" yang formatnya buat ditampilkan.
  dateValue: string
  summary: string
  // Tipe approver step yang lagi aktif — dipakai buat Izin Sakit membedakan
  // step Pegawai Pengganti (tombol Bersedia/Tidak Bersedia) dari step
  // approval biasa (tombol Setujui/Tolak).
  currentStepType: ApproverType
}

export type ApprovalHistoryRow = {
  id: number
  publicId: string
  kind: ApprovalQueueRow["kind"]
  applicant: string
  type: string
  date: string
  dateValue: string
  summary: string
  status: "APPROVED" | "REJECTED"
  actedAt: string
}

export type ApprovalStats = {
  pending: number
  approvedThisMonth: number
  rejectedThisMonth: number
}

const HISTORY_STATUS_LABEL: Record<ApprovalHistoryRow["status"], string> = {
  APPROVED: "Disetujui",
  REJECTED: "Ditolak",
}

const HISTORY_STATUS_VARIANT: Record<
  ApprovalHistoryRow["status"],
  "default" | "destructive"
> = {
  APPROVED: "default",
  REJECTED: "destructive",
}

const KIND_CONFIG = {
  lembur: {
    detailSegment: "",
    approve: approveOvertimeRequestAction,
    reject: rejectOvertimeRequestAction,
    rejectTitle: "Tolak Pengajuan Lembur",
    rejectSuccessMessage: "Pengajuan lembur ditolak.",
  },
  meninggalkan_kantor: {
    detailSegment: "meninggalkan-kantor/",
    approve: approveOfficeExitRequestAction,
    reject: rejectOfficeExitRequestAction,
    rejectTitle: "Tolak Izin Meninggalkan Kantor",
    rejectSuccessMessage: "Izin meninggalkan kantor ditolak.",
  },
  pulang_cepat: {
    detailSegment: "pulang-cepat/",
    approve: approveEarlyLeaveRequestAction,
    reject: rejectEarlyLeaveRequestAction,
    rejectTitle: "Tolak Izin Pulang Cepat",
    rejectSuccessMessage: "Izin pulang cepat ditolak.",
  },
  terlambat: {
    detailSegment: "terlambat/",
    approve: approveLateArrivalRequestAction,
    reject: rejectLateArrivalRequestAction,
    rejectTitle: "Tolak Izin Terlambat",
    rejectSuccessMessage: "Izin terlambat ditolak.",
  },
  sakit: {
    detailSegment: "sakit/",
    approve: approveSickLeaveRequestAction,
    reject: rejectSickLeaveRequestAction,
    rejectTitle: "Tolak Izin Sakit",
    rejectSuccessMessage: "Izin sakit ditolak.",
    revise: reviseSickLeaveRequestAction,
    reviseTitle: "Tidak Bersedia sebagai Pengganti",
    reviseSuccessMessage: "Anda menyatakan tidak bersedia sebagai pengganti.",
  },
  cuti: {
    detailSegment: "cuti/",
    approve: approveCutiRequestAction,
    reject: rejectCutiRequestAction,
    rejectTitle: "Tolak Izin Cuti",
    rejectSuccessMessage: "Izin cuti ditolak.",
    revise: reviseCutiRequestAction,
    reviseTitle: "Tidak Bersedia sebagai Pengganti",
    reviseSuccessMessage: "Anda menyatakan tidak bersedia sebagai pengganti.",
  },
  cuti_bersalin: {
    detailSegment: "cuti-bersalin/",
    approve: approveMaternityLeaveRequestAction,
    reject: rejectMaternityLeaveRequestAction,
    rejectTitle: "Tolak Cuti Bersalin/Gugur Kandungan",
    rejectSuccessMessage: "Pengajuan ditolak.",
    revise: reviseMaternityLeaveRequestAction,
    reviseTitle: "Tidak Bersedia sebagai Pengganti",
    reviseSuccessMessage: "Anda menyatakan tidak bersedia sebagai pengganti.",
  },
  cuti_khusus: {
    detailSegment: "cuti-khusus/",
    approve: approveSpecialLeaveRequestAction,
    reject: rejectSpecialLeaveRequestAction,
    rejectTitle: "Tolak Cuti Khusus Haji/Umroh",
    rejectSuccessMessage: "Pengajuan ditolak.",
    revise: reviseSpecialLeaveRequestAction,
    reviseTitle: "Tidak Bersedia sebagai Pengganti",
    reviseSuccessMessage: "Anda menyatakan tidak bersedia sebagai pengganti.",
  },
  dispensasi: {
    detailSegment: "dispensasi/",
    approve: approveDispensationRequestAction,
    reject: rejectDispensationRequestAction,
    rejectTitle: "Tolak Dispensasi",
    rejectSuccessMessage: "Pengajuan ditolak.",
    revise: reviseDispensationRequestAction,
    reviseTitle: "Tidak Bersedia sebagai Pengganti",
    reviseSuccessMessage: "Anda menyatakan tidak bersedia sebagai pengganti.",
  },
  cuti_besar: {
    detailSegment: "cuti-besar/",
    approve: approveCutiBesarRequestAction,
    reject: rejectCutiBesarRequestAction,
    rejectTitle: "Tolak Cuti Besar",
    rejectSuccessMessage: "Pengajuan ditolak.",
    revise: reviseCutiBesarRequestAction,
    reviseTitle: "Tidak Bersedia sebagai Pengganti",
    reviseSuccessMessage: "Anda menyatakan tidak bersedia sebagai pengganti.",
  },
  cuti_diluar_tanggungan: {
    detailSegment: "cuti-diluar-tanggungan/",
    approve: approveUnpaidLeaveRequestAction,
    reject: rejectUnpaidLeaveRequestAction,
    rejectTitle: "Tolak Cuti Di Luar Tanggungan",
    rejectSuccessMessage: "Pengajuan ditolak.",
    revise: reviseUnpaidLeaveRequestAction,
    reviseTitle: "Tidak Bersedia sebagai Pengganti",
    reviseSuccessMessage: "Anda menyatakan tidak bersedia sebagai pengganti.",
  },
  absen_luar_kantor: {
    detailSegment: "absen-luar-kantor/",
    approve: approveOffSiteAttendanceRequestAction,
    reject: rejectOffSiteAttendanceRequestAction,
    rejectTitle: "Tolak Izin Absen Diluar Kantor",
    rejectSuccessMessage: "Izin absen diluar kantor ditolak.",
  },
  tidak_absen: {
    detailSegment: "tidak-absen/",
    approve: approveAttendanceStatementRequestAction,
    reject: rejectAttendanceStatementRequestAction,
    rejectTitle: "Tolak Pernyataan Tidak Absen",
    rejectSuccessMessage: "Pernyataan tidak absen ditolak.",
  },
} as const

function detailHref(
  basePath: "/admin" | "/pegawai",
  row: { kind: ApprovalQueueRow["kind"]; publicId: string }
) {
  return `${basePath}/riwayat-izin/${KIND_CONFIG[row.kind].detailSegment}${row.publicId}`
}

function ApprovalActions({
  row,
  basePath,
}: {
  row: ApprovalQueueRow
  basePath: "/admin" | "/pegawai"
}) {
  const [isPending, startTransition] = useTransition()
  const config = KIND_CONFIG[row.kind]

  function handleApprove() {
    startTransition(async () => {
      const result = await config.approve(row.id)
      if (result?.error) {
        toast.error(result.error)
      } else {
        toast.success(`Pengajuan ${row.applicant} disetujui.`)
      }
    })
  }

  // Step Pegawai Pengganti (Izin Sakit, Izin Cuti, Cuti Bersalin, Cuti
  // Khusus) bukan approval biasa — pengganti cuma menyatakan bersedia/tidak,
  // jadi tombolnya beda dari Setujui/Tolak.
  const isSubstituteStep =
    (row.kind === "sakit" ||
      row.kind === "cuti" ||
      row.kind === "cuti_bersalin" ||
      row.kind === "cuti_khusus" ||
      row.kind === "dispensasi" ||
      row.kind === "cuti_besar" ||
      row.kind === "cuti_diluar_tanggungan") &&
    row.currentStepType === "PEGAWAI_PENGGANTI"

  return (
    <div className="flex gap-2">
      <Button
        variant="outline"
        size="sm"
        render={<Link href={detailHref(basePath, row)} />}
        nativeButton={false}
      >
        <Eye className="size-3.5" />
        Detail
      </Button>
      <Button size="sm" disabled={isPending} onClick={handleApprove}>
        {isSubstituteStep ? "Bersedia" : "Setujui"}
      </Button>
      {isSubstituteStep &&
      (row.kind === "sakit" ||
        row.kind === "cuti" ||
        row.kind === "cuti_bersalin" ||
        row.kind === "cuti_khusus" ||
        row.kind === "dispensasi" ||
        row.kind === "cuti_besar" ||
        row.kind === "cuti_diluar_tanggungan") ? (
        <RejectDialog
          requestId={row.id}
          applicant={row.applicant}
          title={KIND_CONFIG[row.kind].reviseTitle}
          successMessage={KIND_CONFIG[row.kind].reviseSuccessMessage}
          rejectAction={KIND_CONFIG[row.kind].revise}
        />
      ) : (
        <RejectDialog
          requestId={row.id}
          applicant={row.applicant}
          title={config.rejectTitle}
          successMessage={config.rejectSuccessMessage}
          rejectAction={config.reject}
        />
      )}
    </div>
  )
}

export function ApprovalCenterContent({
  queue,
  history,
  stats,
  basePath,
}: {
  queue: ApprovalQueueRow[]
  history: ApprovalHistoryRow[]
  stats: ApprovalStats
  basePath: "/admin" | "/pegawai"
}) {
  const [startDate, setStartDate] = useState(todayDateValue)
  const [endDate, setEndDate] = useState(todayDateValue)

  const filteredQueue = queue.filter(
    (r) => (!startDate || r.dateValue >= startDate) && (!endDate || r.dateValue <= endDate)
  )
  const filteredHistory = history.filter(
    (r) => (!startDate || r.dateValue >= startDate) && (!endDate || r.dateValue <= endDate)
  )

  const columns: ColumnDef<ApprovalQueueRow, unknown>[] = [
    { accessorKey: "applicant", header: "Pemohon" },
    { accessorKey: "type", header: "Jenis Izin" },
    { accessorKey: "date", header: "Tanggal Pengajuan" },
    {
      accessorKey: "summary",
      header: "Keterangan",
      cell: ({ row }) => (
        <p className="max-w-[280px] truncate" title={row.original.summary}>
          {row.original.summary}
        </p>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: () => <Badge variant="secondary">Menunggu Approval</Badge>,
    },
    {
      id: "actions",
      header: "Aksi",
      cell: ({ row }) => <ApprovalActions row={row.original} basePath={basePath} />,
    },
  ]

  const historyColumns: ColumnDef<ApprovalHistoryRow, unknown>[] = [
    { accessorKey: "applicant", header: "Pemohon" },
    { accessorKey: "type", header: "Jenis Izin" },
    { accessorKey: "date", header: "Tanggal Pengajuan" },
    {
      accessorKey: "summary",
      header: "Keterangan",
      cell: ({ row }) => (
        <p className="max-w-[280px] truncate" title={row.original.summary}>
          {row.original.summary}
        </p>
      ),
    },
    {
      id: "status",
      header: "Status",
      accessorFn: (row) => HISTORY_STATUS_LABEL[row.status],
      cell: ({ row }) => (
        <Badge variant={HISTORY_STATUS_VARIANT[row.original.status]}>
          {HISTORY_STATUS_LABEL[row.original.status]}
        </Badge>
      ),
    },
    { accessorKey: "actedAt", header: "Diproses Pada" },
    {
      id: "actions",
      header: "Aksi",
      cell: ({ row }) => (
        <Button
          variant="outline"
          size="sm"
          render={<Link href={detailHref(basePath, row.original)} />}
          nativeButton={false}
        >
          <Eye className="size-3.5" />
          Detail
        </Button>
      ),
    },
  ]

  const statCards = [
    { label: "Menunggu Approval", value: stats.pending, icon: Clock },
    { label: "Disetujui Bulan Ini", value: stats.approvedThisMonth, icon: CheckCircle2 },
    { label: "Ditolak Bulan Ini", value: stats.rejectedThisMonth, icon: XCircle },
  ]

  const dateRangeFilter = (
    <div className="flex flex-wrap items-center gap-2">
      <Label className="shrink-0">Tanggal</Label>
      <span className="text-sm text-muted-foreground">Dari</span>
      <Input
        aria-label="Dari tanggal"
        type="date"
        value={startDate}
        max={endDate || undefined}
        onChange={(e) => setStartDate(e.target.value)}
        className="w-fit"
      />
      <span className="text-sm text-muted-foreground">Sampai</span>
      <Input
        aria-label="Sampai tanggal"
        type="date"
        value={endDate}
        min={startDate || undefined}
        onChange={(e) => setEndDate(e.target.value)}
        className="w-fit"
      />
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          setStartDate(todayDateValue())
          setEndDate(todayDateValue())
        }}
      >
        Hari Ini
      </Button>
    </div>
  )

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold">Approval Center</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Pantau dan proses pengajuan izin dari tim Anda yang masuk ke antrian
        approval.
      </p>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        {statCards.map((stat) => {
          const Icon = stat.icon
          return (
            <Card key={stat.label}>
              <CardContent className="flex items-center gap-3 py-5">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Icon className="size-5" />
                </span>
                <div>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                  <p className="text-xl font-bold">{stat.value}</p>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Tabs defaultValue="antrian">
        <TabsList>
          <TabsTrigger value="antrian">Menunggu Approval</TabsTrigger>
          <TabsTrigger value="riwayat">Riwayat Approval</TabsTrigger>
        </TabsList>

        <TabsPanel value="antrian">
          <DataTable
            columns={columns}
            data={filteredQueue}
            searchPlaceholder="Cari pemohon, jenis izin..."
            emptyMessage="Belum ada pengajuan yang masuk pada rentang tanggal ini."
            toolbarEnd={dateRangeFilter}
          />
        </TabsPanel>

        <TabsPanel value="riwayat">
          <DataTable
            columns={historyColumns}
            data={filteredHistory}
            searchPlaceholder="Cari pemohon, jenis izin..."
            emptyMessage="Belum ada riwayat approval pada rentang tanggal ini."
            toolbarEnd={dateRangeFilter}
          />
        </TabsPanel>
      </Tabs>
    </div>
  )
}
