"use client"

import { useState, useTransition, type FormEvent } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { toast } from "sonner"

import {
  createSalaryComponentAction,
  updateSalaryComponentAction,
  deleteSalaryComponentAction,
  toggleSalaryComponentActiveAction,
} from "@/server/actions/salary-component"
import {
  SALARY_COMPONENT_CATEGORIES,
  SALARY_COMPONENT_CATEGORY_LABEL,
  SALARY_COMPONENT_CALCULATION_TYPES,
  SALARY_COMPONENT_CALCULATION_TYPE_LABEL,
} from "@/lib/validations/salary-component"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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

export type SalaryComponent = {
  id: number
  name: string
  category: (typeof SALARY_COMPONENT_CATEGORIES)[number]
  calculationType: (typeof SALARY_COMPONENT_CALCULATION_TYPES)[number]
  percentageValue: number | null
  baseComponentId: number | null
  baseComponentName: string | null
  includedInBruto: boolean
  isTaxable: boolean
  isBaseSalary: boolean
  displayOrder: number
  isActive: boolean
}

const CATEGORY_VARIANT: Record<
  SalaryComponent["category"],
  "default" | "secondary" | "destructive" | "outline"
> = {
  PENDAPATAN_TETAP: "default",
  PENDAPATAN_TIDAK_TETAP: "secondary",
  POTONGAN: "destructive",
  PINJAMAN: "outline",
}

function ComponentDialog({
  item,
  allComponents,
  onOpenChange,
}: {
  item: SalaryComponent | "new" | null
  allComponents: SalaryComponent[]
  onOpenChange: (open: boolean) => void
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [calculationType, setCalculationType] = useState<SalaryComponent["calculationType"]>(
    item && item !== "new" ? item.calculationType : "NOMINAL_TETAP"
  )

  const isEdit = item !== null && item !== "new"
  const baseOptions = allComponents.filter((c) => !isEdit || c.id !== item.id)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const action = isEdit
      ? updateSalaryComponentAction.bind(null, item.id)
      : createSalaryComponentAction

    startTransition(async () => {
      const result = await action(undefined, formData)
      if (result?.error) {
        setError(result.error)
        toast.error(result.error)
      } else {
        setError(null)
        onOpenChange(false)
        toast.success(isEdit ? "Komponen gaji berhasil diperbarui." : "Komponen gaji berhasil ditambahkan.")
      }
    })
  }

  return (
    <Dialog open={item !== null} onOpenChange={(open) => !open && onOpenChange(false)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Komponen Gaji" : "Tambah Komponen Gaji"}</DialogTitle>
        </DialogHeader>
        <form
          key={isEdit ? item.id : "new"}
          onSubmit={handleSubmit}
          className="grid gap-4"
        >
          <div className="grid gap-2">
            <Label htmlFor="name">Nama Komponen</Label>
            <Input
              id="name"
              name="name"
              placeholder="mis. Tunjangan Jabatan"
              defaultValue={isEdit ? item.name : ""}
              required
            />
          </div>

          <div className="grid gap-2">
            <Label>Kategori</Label>
            <Select
              name="category"
              defaultValue={isEdit ? item.category : "PENDAPATAN_TETAP"}
              items={SALARY_COMPONENT_CATEGORIES.map((c) => ({
                value: c,
                label: SALARY_COMPONENT_CATEGORY_LABEL[c],
              }))}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Pilih kategori" />
              </SelectTrigger>
              <SelectContent>
                {SALARY_COMPONENT_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {SALARY_COMPONENT_CATEGORY_LABEL[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>Jenis Perhitungan</Label>
            <Select
              name="calculationType"
              value={calculationType}
              onValueChange={(v) => setCalculationType(v as SalaryComponent["calculationType"])}
              items={SALARY_COMPONENT_CALCULATION_TYPES.map((c) => ({
                value: c,
                label: SALARY_COMPONENT_CALCULATION_TYPE_LABEL[c],
              }))}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Pilih jenis perhitungan" />
              </SelectTrigger>
              <SelectContent>
                {SALARY_COMPONENT_CALCULATION_TYPES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {SALARY_COMPONENT_CALCULATION_TYPE_LABEL[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {calculationType === "PERSENTASE" ? (
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="percentageValue">Persentase (%)</Label>
                <Input
                  id="percentageValue"
                  name="percentageValue"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="mis. 100 buat sama persis"
                  defaultValue={isEdit ? (item.percentageValue ?? "") : ""}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label>Komponen Dasar</Label>
                <Select
                  name="baseComponentId"
                  defaultValue={isEdit && item.baseComponentId ? String(item.baseComponentId) : ""}
                  items={baseOptions.map((c) => ({ value: String(c.id), label: c.name }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Pilih komponen" />
                  </SelectTrigger>
                  <SelectContent>
                    {baseOptions.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : null}

          <div className="grid gap-2">
            <Label htmlFor="displayOrder">Urutan Tampil</Label>
            <Input
              id="displayOrder"
              name="displayOrder"
              type="number"
              defaultValue={isEdit ? item.displayOrder : 0}
            />
          </div>

          <div className="grid gap-3">
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                name="includedInBruto"
                className="mt-0.5"
                defaultChecked={isEdit ? item.includedInBruto : true}
              />
              <span>Termasuk Bruto (seksi &quot;Penerimaan&quot;, bukan &quot;Penerimaan Lain&quot;)</span>
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                name="isTaxable"
                className="mt-0.5"
                defaultChecked={isEdit ? item.isTaxable : false}
              />
              <span>Kena Pajak (dipakai untuk perhitungan PPh 21)</span>
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                name="isBaseSalary"
                className="mt-0.5"
                defaultChecked={isEdit ? item.isBaseSalary : false}
              />
              <span>
                Ini komponen Gaji Pokok (nilainya diambil otomatis dari Skala
                Gaji PP saat Proses Payroll — cuma boleh SATU komponen yang
                ditandai ini, menandai yang lain otomatis membatalkan tanda
                sebelumnya)
              </span>
            </label>
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

export function SalaryComponentTable({ components }: { components: SalaryComponent[] }) {
  const [dialogItem, setDialogItem] = useState<SalaryComponent | "new" | null>(null)
  const [deletingItem, setDeletingItem] = useState<SalaryComponent | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleToggleActive(row: SalaryComponent) {
    startTransition(async () => {
      await toggleSalaryComponentActiveAction(row.id, !row.isActive)
      toast.success(row.isActive ? `"${row.name}" dinonaktifkan.` : `"${row.name}" diaktifkan.`)
    })
  }

  function handleDelete() {
    if (!deletingItem) return
    const item = deletingItem
    startTransition(async () => {
      const result = await deleteSalaryComponentAction(item.id)
      if (result?.error) {
        toast.error(result.error)
      } else {
        toast.success(`Komponen "${item.name}" berhasil dihapus.`)
      }
      setDeletingItem(null)
    })
  }

  const columns: ColumnDef<SalaryComponent, unknown>[] = [
    { accessorKey: "displayOrder", header: "Urutan" },
    {
      id: "name",
      header: "Nama Komponen",
      accessorFn: (row) => row.name,
      cell: ({ row }) => (
        <span className="flex items-center gap-1.5">
          {row.original.name}
          {row.original.isBaseSalary ? <Badge variant="outline">Gaji Pokok</Badge> : null}
        </span>
      ),
    },
    {
      id: "category",
      header: "Kategori",
      accessorFn: (row) => SALARY_COMPONENT_CATEGORY_LABEL[row.category],
      cell: ({ row }) => (
        <Badge variant={CATEGORY_VARIANT[row.original.category]}>
          {SALARY_COMPONENT_CATEGORY_LABEL[row.original.category]}
        </Badge>
      ),
    },
    {
      id: "calculationType",
      header: "Jenis Perhitungan",
      cell: ({ row }) => {
        const c = row.original
        const label = SALARY_COMPONENT_CALCULATION_TYPE_LABEL[c.calculationType]
        if (c.calculationType === "PERSENTASE" && c.baseComponentName) {
          return (
            <span>
              {c.percentageValue}% dari <span className="font-medium">{c.baseComponentName}</span>
            </span>
          )
        }
        return label
      },
    },
    {
      id: "includedInBruto",
      header: "Bruto",
      cell: ({ row }) =>
        row.original.category.startsWith("PENDAPATAN") ? (
          <Badge variant="outline" className="text-xs">
            {row.original.includedInBruto ? "Ya" : "Tidak"}
          </Badge>
        ) : (
          <span className="text-muted-foreground">-</span>
        ),
    },
    {
      id: "isTaxable",
      header: "Kena Pajak",
      cell: ({ row }) => (
        <Badge variant="outline" className="text-xs">
          {row.original.isTaxable ? "Ya" : "Tidak"}
        </Badge>
      ),
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
          <Button
            size="sm"
            variant="destructive"
            onClick={() => setDeletingItem(row.original)}
          >
            Hapus
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Daftar Komponen Gaji</h2>
        <Button onClick={() => setDialogItem("new")}>Tambah Komponen</Button>
      </div>

      <DataTable
        columns={columns}
        data={components}
        searchPlaceholder="Cari komponen gaji..."
        emptyMessage="Belum ada komponen gaji."
      />

      <ComponentDialog
        key={dialogItem && dialogItem !== "new" ? dialogItem.id : "new"}
        item={dialogItem}
        allComponents={components}
        onOpenChange={(open) => !open && setDialogItem(null)}
      />

      <AlertDialog open={deletingItem !== null} onOpenChange={(open) => !open && setDeletingItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus komponen gaji?</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{deletingItem?.name}&quot; akan dihapus permanen. Tidak bisa dihapus kalau masih
              dipakai sebagai komponen dasar oleh komponen lain.
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
