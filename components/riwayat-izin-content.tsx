"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import type { ColumnDef } from "@tanstack/react-table"
import { Eye, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { deleteOvertimeRequestAction } from "@/server/actions/overtime"
import { deleteOfficeExitRequestAction } from "@/server/actions/office-exit"
import { deleteEarlyLeaveRequestAction } from "@/server/actions/early-leave"
import { deleteLateArrivalRequestAction } from "@/server/actions/late-arrival"
import { deleteSickLeaveRequestAction } from "@/server/actions/sick-leave"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DataTable } from "@/components/data-table"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

export type IzinHistoryRow = {
  id: number
  publicId: string
  kind: "lembur" | "meninggalkan_kantor" | "pulang_cepat" | "terlambat" | "sakit"
  type: string
  date: string
  summary: string
  status: "PENDING_APPROVAL" | "APPROVED" | "REJECTED" | "COMPLETED" | "REVISI"
  stepLabel: string
  canDelete: boolean
}

const DETAIL_SEGMENT: Record<IzinHistoryRow["kind"], string> = {
  lembur: "",
  meninggalkan_kantor: "meninggalkan-kantor/",
  pulang_cepat: "pulang-cepat/",
  terlambat: "terlambat/",
  sakit: "sakit/",
}

const DELETE_ACTION: Record<
  IzinHistoryRow["kind"],
  (id: number) => Promise<void>
> = {
  lembur: deleteOvertimeRequestAction,
  meninggalkan_kantor: deleteOfficeExitRequestAction,
  pulang_cepat: deleteEarlyLeaveRequestAction,
  terlambat: deleteLateArrivalRequestAction,
  sakit: deleteSickLeaveRequestAction,
}

// Status cuma soal approval, jadi diseragamkan untuk semua jenis izin —
// termasuk Izin Lembur, yang statusnya tetap "APPROVED" di database sampai
// Tahap 2 diisi (baru jadi "COMPLETED"). Progres tahap ekstra itu ditampilkan
// di kolom Step, bukan di sini, supaya Status konsisten di semua baris.
const STATUS_LABEL: Record<IzinHistoryRow["status"], string> = {
  PENDING_APPROVAL: "Menunggu Approval",
  APPROVED: "Disetujui",
  REJECTED: "Ditolak",
  COMPLETED: "Disetujui",
  REVISI: "Perlu Revisi",
}

const STATUS_VARIANT: Record<
  IzinHistoryRow["status"],
  "default" | "secondary" | "destructive" | "outline"
> = {
  PENDING_APPROVAL: "secondary",
  APPROVED: "default",
  REJECTED: "destructive",
  COMPLETED: "default",
  REVISI: "secondary",
}

function detailHref(basePath: string, row: IzinHistoryRow) {
  return `${basePath}/riwayat-izin/${DETAIL_SEGMENT[row.kind]}${row.publicId}`
}

function stepLabelClassName(label: string) {
  if (label === "Selesai") return "text-sm font-medium text-emerald-600 dark:text-emerald-400"
  if (label === "Menunggu Tahap 2" || label === "Menunggu Pengganti Baru")
    return "text-sm text-amber-600 dark:text-amber-400"
  return "text-sm text-muted-foreground"
}

function buildColumns(
  basePath: string,
  onDeleteClick: (row: IzinHistoryRow) => void
): ColumnDef<IzinHistoryRow, unknown>[] {
  return [
    { accessorKey: "type", header: "Jenis Izin" },
    { accessorKey: "date", header: "Tanggal" },
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
      accessorKey: "stepLabel",
      header: "Step",
      cell: ({ row }) => (
        <span className={stepLabelClassName(row.original.stepLabel)}>
          {row.original.stepLabel}
        </span>
      ),
    },
    {
      id: "status",
      header: "Status",
      accessorFn: (row) => STATUS_LABEL[row.status],
      cell: ({ row }) => (
        <Badge variant={STATUS_VARIANT[row.original.status]}>
          {STATUS_LABEL[row.original.status]}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: "Aksi",
      cell: ({ row }) => (
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            render={<Link href={detailHref(basePath, row.original)} />}
            nativeButton={false}
          >
            <Eye className="size-3.5" />
            Detail
          </Button>
          {row.original.canDelete ? (
            <Button
              variant="destructive"
              size="icon-sm"
              aria-label="Hapus"
              title="Hapus"
              onClick={() => onDeleteClick(row.original)}
            >
              <Trash2 className="size-3.5" />
            </Button>
          ) : null}
        </div>
      ),
    },
  ]
}

export function RiwayatIzinContent({
  izinRequests,
  basePath,
}: {
  izinRequests: IzinHistoryRow[]
  basePath: "/admin" | "/pegawai"
}) {
  const [deleting, setDeleting] = useState<IzinHistoryRow | null>(null)
  const [isPending, startTransition] = useTransition()

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold">Riwayat Izin</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Daftar pengajuan izin, cuti, dan sakit yang pernah Anda ajukan.
      </p>

      <DataTable
        columns={buildColumns(basePath, setDeleting)}
        data={izinRequests}
        searchPlaceholder="Cari riwayat izin..."
        emptyMessage="Belum ada pengajuan izin."
      />

      <AlertDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus pengajuan izin?</AlertDialogTitle>
            <AlertDialogDescription>
              Pengajuan yang belum ada approver-nya menyetujui bisa dihapus.
              Tindakan ini tidak bisa dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              disabled={isPending}
              onClick={() => {
                if (deleting === null) return
                const target = deleting
                startTransition(async () => {
                  try {
                    await DELETE_ACTION[target.kind](target.id)
                    toast.success("Pengajuan izin berhasil dihapus.")
                  } catch (e) {
                    toast.error(
                      e instanceof Error ? e.message : "Gagal menghapus pengajuan."
                    )
                  } finally {
                    setDeleting(null)
                  }
                })
              }}
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
