"use client"

import { useMemo, useState, useTransition, type FormEvent } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { toast } from "sonner"

import {
  createTerRateAction,
  updateTerRateAction,
  deleteTerRateAction,
} from "@/server/actions/payroll-tax"
import { TER_CATEGORIES } from "@/lib/validations/payroll-tax"
import { TerRateImportButton } from "@/components/ter-rate-import-button"
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

export type TerRate = {
  id: number
  category: (typeof TER_CATEGORIES)[number]
  order: number
  minIncome: number
  maxIncome: number | null
  ratePercent: number
}

function formatRupiah(value: number) {
  return `Rp${value.toLocaleString("id-ID")}`
}

function TerRateDialog({
  item,
  defaultCategory,
  onOpenChange,
}: {
  item: TerRate | "new" | null
  defaultCategory: (typeof TER_CATEGORIES)[number]
  onOpenChange: (open: boolean) => void
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const isEdit = item !== null && item !== "new"

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const action = isEdit ? updateTerRateAction.bind(null, item.id) : createTerRateAction

    startTransition(async () => {
      const result = await action(undefined, formData)
      if (result?.error) {
        setError(result.error)
        toast.error(result.error)
      } else {
        setError(null)
        onOpenChange(false)
        toast.success(isEdit ? "Tarif TER berhasil diperbarui." : "Tarif TER berhasil ditambahkan.")
      }
    })
  }

  return (
    <Dialog open={item !== null} onOpenChange={(open) => !open && onOpenChange(false)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Tarif TER" : "Tambah Tarif TER"}</DialogTitle>
        </DialogHeader>
        <form key={isEdit ? item.id : "new"} onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="category">Kategori</Label>
            <select
              id="category"
              name="category"
              defaultValue={isEdit ? item.category : defaultCategory}
              className="h-9 rounded-lg border border-input bg-transparent px-3 text-sm dark:bg-input/30"
            >
              {TER_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  Kategori {c}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="minIncome">Bruto Dari (Rp/bulan)</Label>
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
              <Label htmlFor="maxIncome">Sampai (Rp/bulan)</Label>
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
              <Label htmlFor="ratePercent">Tarif TER (%)</Label>
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

export function TerRateTable({ rates }: { rates: TerRate[] }) {
  const [category, setCategory] = useState<(typeof TER_CATEGORIES)[number]>("A")
  const [dialogItem, setDialogItem] = useState<TerRate | "new" | null>(null)
  const [deletingItem, setDeletingItem] = useState<TerRate | null>(null)
  const [isPending, startTransition] = useTransition()

  const filteredRates = useMemo(() => rates.filter((r) => r.category === category), [rates, category])

  function handleDelete() {
    if (!deletingItem) return
    const item = deletingItem
    startTransition(async () => {
      await deleteTerRateAction(item.id)
      toast.success("Tarif TER berhasil dihapus.")
      setDeletingItem(null)
    })
  }

  const columns: ColumnDef<TerRate, unknown>[] = [
    { accessorKey: "order", header: "Urutan" },
    {
      id: "range",
      header: "Lapisan Bruto (Bulanan)",
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
        <CardTitle>Tarif TER (PMK 168/2023)</CardTitle>
        <div className="flex gap-2">
          <TerRateImportButton />
          <Button size="sm" onClick={() => setDialogItem("new")}>
            Tambah Tarif
          </Button>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        <p className="text-sm text-muted-foreground">
          Kategori ditentukan otomatis dari status PTKP pegawai — Kategori A
          (TK/0, TK/1, K/0), Kategori B (TK/2, TK/3, K/1, K/2), Kategori C
          (K/3). Isi nominalnya sesuai lampiran PMK 168/2023.
        </p>
        <div className="flex gap-2">
          {TER_CATEGORIES.map((c) => (
            <Button
              key={c}
              type="button"
              size="sm"
              variant={category === c ? "default" : "outline"}
              onClick={() => setCategory(c)}
            >
              Kategori {c}
            </Button>
          ))}
        </div>
        <DataTable
          columns={columns}
          data={filteredRates}
          searchPlaceholder="Cari..."
          emptyMessage={`Belum ada tarif TER Kategori ${category}.`}
          pageSize={20}
        />
      </CardContent>

      <TerRateDialog item={dialogItem} defaultCategory={category} onOpenChange={(open) => !open && setDialogItem(null)} />

      <AlertDialog open={deletingItem !== null} onOpenChange={(open) => !open && setDeletingItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus tarif TER?</AlertDialogTitle>
            <AlertDialogDescription>
              Tarif TER Kategori {deletingItem?.category} — {deletingItem?.ratePercent}% ini akan dihapus permanen.
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
