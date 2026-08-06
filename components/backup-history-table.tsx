"use client"

import { useMemo, useState, useTransition, type ReactNode } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { toast } from "sonner"

import type { BackupScope, BackupStatus } from "@prisma/client"
import { BACKUP_SCOPE_LABEL } from "@/lib/backup/table-groups"
import { deleteBackupAction } from "@/server/actions/backup"
import { cn } from "@/lib/utils"
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

export type BackupHistoryRow = {
  publicId: string
  scope: BackupScope
  status: BackupStatus
  triggeredByUsername: string
  fileSizeBytes: number | null
  startedAt: Date
  errorMessage: string | null
}

const STATUS_LABEL: Record<BackupStatus, string> = {
  RUNNING: "Berjalan",
  SUCCESS: "Berhasil",
  FAILED: "Gagal",
}

const STATUS_CLASS: Record<BackupStatus, string> = {
  RUNNING: "border-blue-200 bg-blue-50 text-blue-600 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-400",
  SUCCESS:
    "border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400",
  FAILED: "border-destructive/20 bg-destructive/10 text-destructive",
}

function formatSize(bytes: number | null) {
  if (bytes === null) return "-"
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

function formatDateTime(date: Date) {
  return date.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function BackupHistoryTable({ rows, filters }: { rows: BackupHistoryRow[]; filters?: ReactNode }) {
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleDelete() {
    if (!deletingId) return
    startTransition(async () => {
      const result = await deleteBackupAction(deletingId)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Backup dihapus.")
        setDeletingId(null)
      }
    })
  }

  const columns: ColumnDef<BackupHistoryRow, unknown>[] = useMemo(
    () => [
      {
        id: "startedAt",
        header: "Tanggal & Waktu",
        accessorFn: (row) => formatDateTime(row.startedAt),
      },
      {
        id: "scope",
        header: "Cakupan",
        accessorFn: (row) => BACKUP_SCOPE_LABEL[row.scope],
      },
      { accessorKey: "triggeredByUsername", header: "Dipicu Oleh" },
      {
        id: "fileSizeBytes",
        header: "Ukuran",
        cell: ({ row }) => (
          <span className="tabular-nums">{formatSize(row.original.fileSizeBytes)}</span>
        ),
      },
      {
        id: "status",
        header: "Status",
        cell: ({ row }) => (
          <Badge
            variant="outline"
            className={cn(STATUS_CLASS[row.original.status])}
            title={row.original.status === "FAILED" ? (row.original.errorMessage ?? undefined) : undefined}
          >
            {STATUS_LABEL[row.original.status]}
          </Badge>
        ),
      },
      {
        id: "actions",
        header: "Aksi",
        cell: ({ row }) => (
          <div className="flex justify-end gap-2">
            {row.original.status === "SUCCESS" ? (
              <Button
                size="sm"
                variant="outline"
                render={<a href={`/api/backup/${row.original.publicId}/download`} />}
              >
                Unduh
              </Button>
            ) : null}
            <Button
              size="sm"
              variant="destructive"
              disabled={row.original.status === "RUNNING"}
              onClick={() => setDeletingId(row.original.publicId)}
            >
              Hapus
            </Button>
          </div>
        ),
        meta: { className: "text-right" },
      },
    ],
    []
  )

  return (
    <>
      <DataTable
        columns={columns}
        data={rows}
        searchPlaceholder="Cari yang memicu backup..."
        emptyMessage="Belum ada backup yang pernah dibuat."
        toolbarEnd={filters}
      />

      <AlertDialog open={deletingId !== null} onOpenChange={(open) => !open && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus backup ini?</AlertDialogTitle>
            <AlertDialogDescription>
              File backup akan dihapus permanen dari server dan tidak bisa dikembalikan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction disabled={isPending} onClick={handleDelete}>
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
