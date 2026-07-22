"use client"

import { useState, useTransition } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import type { Prisma } from "@prisma/client"
import { toast } from "sonner"

import { restoreEmployeeAction } from "@/server/actions/employees"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { DataTable } from "@/components/data-table"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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

type DeletedEmployeeRow = Prisma.EmployeeGetPayload<{
  include: { department: true; position: true }
}>

function formatDateTime(date: Date | null) {
  if (!date) return "-"
  return date.toLocaleString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function DeletedEmployeesTable({
  employees,
}: {
  employees: DeletedEmployeeRow[]
}) {
  const [isPending, startTransition] = useTransition()
  const [detailRow, setDetailRow] = useState<DeletedEmployeeRow | null>(null)
  const [restoringRow, setRestoringRow] = useState<DeletedEmployeeRow | null>(null)
  const [restoreReason, setRestoreReason] = useState("")

  const columns: ColumnDef<DeletedEmployeeRow, unknown>[] = [
    { accessorKey: "employeeNumber", header: "NIP" },
    { accessorKey: "fullName", header: "Nama" },
    {
      id: "department",
      header: "Bagian",
      accessorFn: (row) => row.department.name,
    },
    {
      id: "reason",
      header: "Alasan",
      accessorFn: (row) => row.deleteReason ?? "-",
    },
    {
      id: "deletedBy",
      header: "Dihapus Oleh",
      accessorFn: (row) => row.deletedBy ?? "-",
    },
    {
      id: "actions",
      header: "Aksi",
      cell: ({ row }) => (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setDetailRow(row.original)}
          >
            Detail
          </Button>
          <Button
            size="sm"
            disabled={isPending}
            onClick={() => {
              setRestoreReason("")
              setRestoringRow(row.original)
            }}
          >
            Pulihkan
          </Button>
        </div>
      ),
    },
  ]

  return (
    <>
      <DataTable
        columns={columns}
        data={employees}
        searchPlaceholder="Cari pegawai terhapus..."
        emptyMessage="Tidak ada data terhapus."
      />

      <Dialog open={detailRow !== null} onOpenChange={(open) => !open && setDetailRow(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Detail Penghapusan</DialogTitle>
          </DialogHeader>
          {detailRow ? (
            <dl className="grid gap-3 text-sm">
              <div className="grid grid-cols-3 gap-2">
                <dt className="text-muted-foreground">Nama</dt>
                <dd className="col-span-2 font-medium">{detailRow.fullName}</dd>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <dt className="text-muted-foreground">NIP</dt>
                <dd className="col-span-2">{detailRow.employeeNumber}</dd>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <dt className="text-muted-foreground">Bagian</dt>
                <dd className="col-span-2">{detailRow.department.name}</dd>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <dt className="text-muted-foreground">Dihapus Pada</dt>
                <dd className="col-span-2">{formatDateTime(detailRow.deletedAt)}</dd>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <dt className="text-muted-foreground">Dihapus Oleh</dt>
                <dd className="col-span-2">{detailRow.deletedBy ?? "-"}</dd>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <dt className="text-muted-foreground">Alasan</dt>
                <dd className="col-span-2">{detailRow.deleteReason || "-"}</dd>
              </div>
            </dl>
          ) : null}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={restoringRow !== null}
        onOpenChange={(open) => !open && setRestoringRow(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Pulihkan data pegawai?</AlertDialogTitle>
            <AlertDialogDescription>
              {restoringRow
                ? `"${restoringRow.fullName}" (${restoringRow.employeeNumber}) akan aktif kembali beserta akun login-nya.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            placeholder="Alasan pemulihan (opsional)"
            value={restoreReason}
            onChange={(e) => setRestoreReason(e.target.value)}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              disabled={isPending}
              onClick={() => {
                if (!restoringRow) return
                const id = restoringRow.id
                const reason = restoreReason
                startTransition(async () => {
                  try {
                    await restoreEmployeeAction(id, reason)
                    toast.success("Pegawai berhasil dipulihkan.")
                  } catch {
                    toast.error("Gagal memulihkan pegawai.")
                  } finally {
                    setRestoringRow(null)
                  }
                })
              }}
            >
              Pulihkan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
