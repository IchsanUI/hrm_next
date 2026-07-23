"use client"

import { useState, useTransition, type FormEvent } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { toast } from "sonner"

import {
  createTaxBracketAction,
  updateTaxBracketAction,
  deleteTaxBracketAction,
} from "@/server/actions/payroll-tax"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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

export type TaxBracket = {
  id: number
  order: number
  minIncome: number
  maxIncome: number | null
  ratePercent: number
}

function formatRupiah(value: number) {
  return `Rp${value.toLocaleString("id-ID")}`
}

function BracketDialog({
  item,
  onOpenChange,
}: {
  item: TaxBracket | "new" | null
  onOpenChange: (open: boolean) => void
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const isEdit = item !== null && item !== "new"

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const action = isEdit ? updateTaxBracketAction.bind(null, item.id) : createTaxBracketAction

    startTransition(async () => {
      const result = await action(undefined, formData)
      if (result?.error) {
        setError(result.error)
        toast.error(result.error)
      } else {
        setError(null)
        onOpenChange(false)
        toast.success(isEdit ? "Lapisan tarif berhasil diperbarui." : "Lapisan tarif berhasil ditambahkan.")
      }
    })
  }

  return (
    <Dialog open={item !== null} onOpenChange={(open) => !open && onOpenChange(false)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Lapisan Tarif" : "Tambah Lapisan Tarif"}</DialogTitle>
        </DialogHeader>
        <form key={isEdit ? item.id : "new"} onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="minIncome">Penghasilan Dari (Rp/tahun)</Label>
              <Input
                id="minIncome"
                name="minIncome"
                type="number"
                min="0"
                defaultValue={isEdit ? item.minIncome : ""}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="maxIncome">Sampai (Rp/tahun)</Label>
              <Input
                id="maxIncome"
                name="maxIncome"
                type="number"
                min="0"
                placeholder="kosongkan = tidak terbatas"
                defaultValue={isEdit ? (item.maxIncome ?? "") : ""}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="ratePercent">Tarif (%)</Label>
              <Input
                id="ratePercent"
                name="ratePercent"
                type="number"
                step="any"
                min="0"
                defaultValue={isEdit ? item.ratePercent : ""}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="order">Urutan</Label>
              <Input id="order" name="order" type="number" defaultValue={isEdit ? item.order : 0} />
            </div>
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

export function TaxBracketTable({ brackets }: { brackets: TaxBracket[] }) {
  const [dialogItem, setDialogItem] = useState<TaxBracket | "new" | null>(null)
  const [deletingItem, setDeletingItem] = useState<TaxBracket | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleDelete() {
    if (!deletingItem) return
    const item = deletingItem
    startTransition(async () => {
      await deleteTaxBracketAction(item.id)
      toast.success("Lapisan tarif berhasil dihapus.")
      setDeletingItem(null)
    })
  }

  const columns: ColumnDef<TaxBracket, unknown>[] = [
    { accessorKey: "order", header: "Urutan" },
    {
      id: "range",
      header: "Lapisan Penghasilan (Setahun)",
      cell: ({ row }) =>
        `${formatRupiah(row.original.minIncome)} — ${
          row.original.maxIncome !== null ? formatRupiah(row.original.maxIncome) : "Tidak Terbatas"
        }`,
    },
    {
      id: "ratePercent",
      header: "Tarif",
      accessorFn: (row) => `${row.ratePercent}%`,
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
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Lapisan Tarif PPh 21 (Progresif)</CardTitle>
        <Button size="sm" onClick={() => setDialogItem("new")}>
          Tambah Lapisan
        </Button>
      </CardHeader>
      <CardContent>
        <DataTable
          columns={columns}
          data={brackets}
          searchPlaceholder="Cari..."
          emptyMessage="Belum ada lapisan tarif."
          pageSize={20}
        />
      </CardContent>

      <BracketDialog item={dialogItem} onOpenChange={(open) => !open && setDialogItem(null)} />

      <AlertDialog open={deletingItem !== null} onOpenChange={(open) => !open && setDeletingItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus lapisan tarif?</AlertDialogTitle>
            <AlertDialogDescription>
              Lapisan tarif {deletingItem?.ratePercent}% ini akan dihapus permanen.
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
    </Card>
  )
}
