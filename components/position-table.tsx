"use client"

import { useState, useTransition, type FormEvent } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { toast } from "sonner"

import {
  createPositionAction,
  updatePositionAction,
  deletePositionAction,
} from "@/server/actions/positions"
import { RupiahInput } from "@/components/rupiah-input"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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

export type Position = {
  id: number
  name: string
  attendanceRatePerDay: number | null
}

function formatRupiah(value: number | null) {
  if (value === null) return "-"
  return `Rp${value.toLocaleString("id-ID")}`
}

function PositionDialog({
  item,
  onOpenChange,
}: {
  item: Position | "new" | null
  onOpenChange: (open: boolean) => void
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const isEdit = item !== null && item !== "new"

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const action = isEdit ? updatePositionAction.bind(null, item.id) : createPositionAction

    startTransition(async () => {
      const result = await action(undefined, formData)
      if (result?.error) {
        setError(result.error)
        toast.error(result.error)
      } else {
        setError(null)
        onOpenChange(false)
        toast.success(isEdit ? "Jabatan berhasil diperbarui." : "Jabatan berhasil ditambahkan.")
      }
    })
  }

  return (
    <Dialog open={item !== null} onOpenChange={(open) => !open && onOpenChange(false)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Jabatan" : "Tambah Jabatan"}</DialogTitle>
        </DialogHeader>
        <form key={isEdit ? item.id : "new"} onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Nama Jabatan</Label>
            <Input id="name" name="name" defaultValue={isEdit ? item.name : ""} required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="attendanceRatePerDay">Rate Tunjangan Kehadiran per Hari (Rp)</Label>
            <RupiahInput
              id="attendanceRatePerDay"
              name="attendanceRatePerDay"
              defaultValue={isEdit ? (item.attendanceRatePerDay ?? undefined) : undefined}
            />
            <p className="text-xs text-muted-foreground">
              Kosongkan kalau jabatan ini tidak dapat tunjangan kehadiran.
            </p>
          </div>
          {error ? <p className="text-destructive text-sm">{error}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Menyimpan..." : "Simpan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function PositionTable({ positions }: { positions: Position[] }) {
  const [dialogItem, setDialogItem] = useState<Position | "new" | null>(null)
  const [deletingItem, setDeletingItem] = useState<Position | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleDelete() {
    if (!deletingItem) return
    const item = deletingItem
    startTransition(async () => {
      const result = await deletePositionAction(item.id)
      if (result?.error) {
        toast.error(result.error)
        return
      }
      toast.success(`Jabatan "${item.name}" berhasil dihapus.`)
      setDeletingItem(null)
    })
  }

  const columns: ColumnDef<Position, unknown>[] = [
    { accessorKey: "name", header: "Nama Jabatan" },
    {
      id: "attendanceRatePerDay",
      header: "Rate Tunjangan Kehadiran/Hari",
      accessorFn: (row) => formatRupiah(row.attendanceRatePerDay),
    },
    {
      id: "actions",
      header: "Aksi",
      cell: ({ row }) => (
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setDialogItem(row.original)}>
            Edit
          </Button>
          <Button size="sm" variant="destructive" onClick={() => setDeletingItem(row.original)}>
            Hapus
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div>
      <DataTable
        columns={columns}
        data={positions}
        searchPlaceholder="Cari jabatan..."
        emptyMessage="Belum ada data jabatan."
        toolbarEnd={<Button onClick={() => setDialogItem("new")}>Tambah Jabatan</Button>}
      />

      <PositionDialog item={dialogItem} onOpenChange={(open) => !open && setDialogItem(null)} />

      <AlertDialog open={deletingItem !== null} onOpenChange={(open) => !open && setDeletingItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus jabatan?</AlertDialogTitle>
            <AlertDialogDescription>
              Jabatan &quot;{deletingItem?.name}&quot; akan dihapus permanen.
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
    </div>
  )
}
