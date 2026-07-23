"use client"

import Link from "next/link"
import { useState, useTransition, type FormEvent } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { toast } from "sonner"

import {
  createSalaryScaleVersionAction,
  updateSalaryScaleVersionAction,
  deleteSalaryScaleVersionAction,
  toggleSalaryScaleVersionActiveAction,
} from "@/server/actions/salary-scale"
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

export type SalaryScaleVersion = {
  id: number
  name: string
  effectiveDate: string
  isActive: boolean
  rateCount: number
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  })
}

function VersionDialog({
  item,
  onOpenChange,
}: {
  item: SalaryScaleVersion | "new" | null
  onOpenChange: (open: boolean) => void
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const isEdit = item !== null && item !== "new"

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const action = isEdit
      ? updateSalaryScaleVersionAction.bind(null, item.id)
      : createSalaryScaleVersionAction

    startTransition(async () => {
      const result = await action(undefined, formData)
      if (result?.error) {
        setError(result.error)
        toast.error(result.error)
      } else {
        setError(null)
        onOpenChange(false)
        toast.success(isEdit ? "Versi skala gaji berhasil diperbarui." : "Versi skala gaji berhasil ditambahkan.")
      }
    })
  }

  return (
    <Dialog open={item !== null} onOpenChange={(open) => !open && onOpenChange(false)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Versi Skala Gaji" : "Tambah Versi Skala Gaji"}</DialogTitle>
        </DialogHeader>
        <form key={isEdit ? item.id : "new"} onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Nama / Acuan Peraturan</Label>
            <Input
              id="name"
              name="name"
              placeholder="mis. PP No. 15 Tahun 2019"
              defaultValue={isEdit ? item.name : ""}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="effectiveDate">Tanggal Berlaku</Label>
            <Input
              id="effectiveDate"
              name="effectiveDate"
              type="date"
              defaultValue={isEdit ? item.effectiveDate.slice(0, 10) : ""}
              required
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

export function SalaryScaleVersionTable({ versions }: { versions: SalaryScaleVersion[] }) {
  const [dialogItem, setDialogItem] = useState<SalaryScaleVersion | "new" | null>(null)
  const [deletingItem, setDeletingItem] = useState<SalaryScaleVersion | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleToggleActive(row: SalaryScaleVersion) {
    startTransition(async () => {
      await toggleSalaryScaleVersionActiveAction(row.id, !row.isActive)
      toast.success(row.isActive ? `Versi "${row.name}" dinonaktifkan.` : `Versi "${row.name}" diaktifkan.`)
    })
  }

  function handleDelete() {
    if (!deletingItem) return
    const item = deletingItem
    startTransition(async () => {
      await deleteSalaryScaleVersionAction(item.id)
      toast.success(`Versi "${item.name}" berhasil dihapus.`)
      setDeletingItem(null)
    })
  }

  const columns: ColumnDef<SalaryScaleVersion, unknown>[] = [
    { accessorKey: "name", header: "Nama / Acuan Peraturan" },
    {
      id: "effectiveDate",
      header: "Berlaku Sejak",
      accessorFn: (row) => formatDate(row.effectiveDate),
    },
    {
      id: "rateCount",
      header: "Jumlah Rate Terisi",
      accessorFn: (row) => row.rateCount,
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
          <Button
            size="sm"
            variant="outline"
            render={<Link href={`/admin/payroll/struktur-gaji/skala-pp/${row.original.id}`} />}
            nativeButton={false}
          >
            Kelola Rate
          </Button>
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
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Versi Skala Gaji Pokok (PP)</h2>
        <Button onClick={() => setDialogItem("new")}>Tambah Versi</Button>
      </div>

      <DataTable
        columns={columns}
        data={versions}
        searchPlaceholder="Cari versi..."
        emptyMessage="Belum ada versi skala gaji."
      />

      <VersionDialog item={dialogItem} onOpenChange={(open) => !open && setDialogItem(null)} />

      <AlertDialog open={deletingItem !== null} onOpenChange={(open) => !open && setDeletingItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus versi skala gaji?</AlertDialogTitle>
            <AlertDialogDescription>
              Versi &quot;{deletingItem?.name}&quot; beserta seluruh data rate di dalamnya akan
              dihapus permanen.
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
