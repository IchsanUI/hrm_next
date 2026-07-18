"use client"

import { useTransition } from "react"
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
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DataTable } from "@/components/data-table"
import { RejectDialog } from "@/components/reject-dialog"

export type ApprovalQueueRow = {
  id: number
  publicId: string
  kind: "lembur" | "meninggalkan_kantor" | "pulang_cepat" | "terlambat"
  applicant: string
  type: string
  date: string
  summary: string
}

export type ApprovalStats = {
  pending: number
  approvedThisMonth: number
  rejectedThisMonth: number
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
} as const

function detailHref(basePath: "/admin" | "/pegawai", row: ApprovalQueueRow) {
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
        Setujui
      </Button>
      <RejectDialog
        requestId={row.id}
        applicant={row.applicant}
        title={config.rejectTitle}
        successMessage={config.rejectSuccessMessage}
        rejectAction={config.reject}
      />
    </div>
  )
}

export function ApprovalCenterContent({
  queue,
  stats,
  basePath,
}: {
  queue: ApprovalQueueRow[]
  stats: ApprovalStats
  basePath: "/admin" | "/pegawai"
}) {
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

  const statCards = [
    { label: "Menunggu Approval", value: stats.pending, icon: Clock },
    { label: "Disetujui Bulan Ini", value: stats.approvedThisMonth, icon: CheckCircle2 },
    { label: "Ditolak Bulan Ini", value: stats.rejectedThisMonth, icon: XCircle },
  ]

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

      <DataTable
        columns={columns}
        data={queue}
        searchPlaceholder="Cari pemohon, jenis izin..."
        emptyMessage="Belum ada pengajuan yang masuk."
      />
    </div>
  )
}
