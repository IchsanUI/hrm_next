"use client"

import { useState, useTransition, type FormEvent } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { toast } from "sonner"

import {
  createSalaryGradeAction,
  updateSalaryGradeAction,
  deleteSalaryGradeAction,
  toggleSalaryGradeActiveAction,
} from "@/server/actions/salary-grade"
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

export type SalaryGrade = {
  id: number
  code: string
  subGrade: string
  minSalary: number | null
  maxSalary: number | null
  displayOrder: number
  isActive: boolean
}

function formatRupiah(value: number | null) {
  if (value === null) return "-"
  return `Rp${value.toLocaleString("id-ID")}`
}

function GradeDialog({
  item,
  onOpenChange,
}: {
  item: SalaryGrade | "new" | null
  onOpenChange: (open: boolean) => void
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const isEdit = item !== null && item !== "new"

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const action = isEdit
      ? updateSalaryGradeAction.bind(null, item.id)
      : createSalaryGradeAction

    startTransition(async () => {
      const result = await action(undefined, formData)
      if (result?.error) {
        setError(result.error)
        toast.error(result.error)
      } else {
        setError(null)
        onOpenChange(false)
        toast.success(isEdit ? "Golongan gaji berhasil diperbarui." : "Golongan gaji berhasil ditambahkan.")
      }
    })
  }

  return (
    <Dialog open={item !== null} onOpenChange={(open) => !open && onOpenChange(false)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Golongan Gaji" : "Tambah Golongan Gaji"}</DialogTitle>
        </DialogHeader>
        <form key={isEdit ? item.id : "new"} onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="code">Golongan</Label>
              <Input id="code" name="code" placeholder="mis. C" defaultValue={isEdit ? item.code : ""} required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="subGrade">Ruang</Label>
              <Input
                id="subGrade"
                name="subGrade"
                placeholder="mis. 1"
                defaultValue={isEdit ? item.subGrade : ""}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="minSalary">Gaji Minimum</Label>
              <Input
                id="minSalary"
                name="minSalary"
                type="number"
                min="0"
                defaultValue={isEdit ? (item.minSalary ?? "") : ""}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="maxSalary">Gaji Maksimum</Label>
              <Input
                id="maxSalary"
                name="maxSalary"
                type="number"
                min="0"
                defaultValue={isEdit ? (item.maxSalary ?? "") : ""}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="displayOrder">Urutan Tampil</Label>
            <Input
              id="displayOrder"
              name="displayOrder"
              type="number"
              defaultValue={isEdit ? item.displayOrder : 0}
            />
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

export function SalaryGradeTable({
  grades,
  extraAction,
}: {
  grades: SalaryGrade[]
  extraAction?: React.ReactNode
}) {
  const [dialogItem, setDialogItem] = useState<SalaryGrade | "new" | null>(null)
  const [deletingItem, setDeletingItem] = useState<SalaryGrade | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleToggleActive(row: SalaryGrade) {
    startTransition(async () => {
      await toggleSalaryGradeActiveAction(row.id, !row.isActive)
      toast.success(row.isActive ? `Golongan "${row.code}-${row.subGrade}" dinonaktifkan.` : `Golongan "${row.code}-${row.subGrade}" diaktifkan.`)
    })
  }

  function handleDelete() {
    if (!deletingItem) return
    const item = deletingItem
    startTransition(async () => {
      const result = await deleteSalaryGradeAction(item.id)
      if (result?.error) {
        toast.error(result.error)
        return
      }
      toast.success(`Golongan "${item.code}-${item.subGrade}" berhasil dihapus.`)
      setDeletingItem(null)
    })
  }

  const columns: ColumnDef<SalaryGrade, unknown>[] = [
    { accessorKey: "displayOrder", header: "Urutan" },
    {
      id: "grade",
      header: "Golongan-Ruang",
      accessorFn: (row) => `${row.code}-${row.subGrade}`,
      cell: ({ row }) => (
        <span className="font-medium">
          {row.original.code}-{row.original.subGrade}
        </span>
      ),
    },
    {
      id: "range",
      header: "Rentang Gaji (Referensi)",
      cell: ({ row }) =>
        `${formatRupiah(row.original.minSalary)} — ${formatRupiah(row.original.maxSalary)}`,
    },
    {
      id: "isActive",
      header: "Status",
      cell: ({ row }) => (
        <Button
          variant={row.original.isActive ? "default" : "outline"}
          size="sm"
          disabled={isPending}
          onClick={() => handleToggleActive(row.original)}
        >
          {row.original.isActive ? "Aktif" : "Nonaktif"}
        </Button>
      ),
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
        data={grades}
        searchPlaceholder="Cari golongan..."
        emptyMessage="Belum ada golongan gaji."
        toolbarEnd={
          <div className="flex gap-2">
            {extraAction}
            <Button onClick={() => setDialogItem("new")}>Tambah Golongan</Button>
          </div>
        }
      />

      <GradeDialog item={dialogItem} onOpenChange={(open) => !open && setDialogItem(null)} />

      <AlertDialog open={deletingItem !== null} onOpenChange={(open) => !open && setDeletingItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus golongan gaji?</AlertDialogTitle>
            <AlertDialogDescription>
              Golongan &quot;{deletingItem?.code}-{deletingItem?.subGrade}&quot; akan dihapus permanen.
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
