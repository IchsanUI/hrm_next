"use client"

import { useMemo, useState, useTransition, type FormEvent } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { toast } from "sonner"

import {
  upsertEmployeeSalaryComponentAction,
  toggleEmployeeSalaryComponentActiveAction,
  deleteEmployeeSalaryComponentAction,
} from "@/server/actions/employee-salary-components"
import { RupiahInput } from "@/components/rupiah-input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DataTable } from "@/components/data-table"

type CalculationType = "NOMINAL_TETAP" | "PERSENTASE" | "KEHADIRAN" | "MANUAL_PERIODE"

export type AvailableComponent = {
  id: number
  name: string
  category: string
  calculationType: CalculationType
  percentageValue: number | null
  baseComponentName: string | null
}

export type EmployeeSalaryComponentRow = {
  id: number
  salaryComponentId: number
  name: string
  category: string
  calculationType: CalculationType
  amount: number | null
  percentageValue: number | null
  baseComponentName: string | null
  isActive: boolean
}

const CATEGORY_LABEL: Record<string, string> = {
  PENDAPATAN_TETAP: "Pendapatan Tetap",
  PENDAPATAN_TIDAK_TETAP: "Pendapatan Tidak Tetap",
  POTONGAN: "Potongan",
  PINJAMAN: "Pinjaman",
}

function formatRupiah(value: number) {
  return `Rp${value.toLocaleString("id-ID")}`
}

function valueLabel(row: { calculationType: CalculationType; amount: number | null; percentageValue: number | null; baseComponentName: string | null }) {
  if (row.calculationType === "NOMINAL_TETAP") {
    return row.amount !== null ? formatRupiah(row.amount) : "-"
  }
  if (row.calculationType === "PERSENTASE") {
    return `${row.percentageValue ?? "-"}% dari ${row.baseComponentName ?? "-"}`
  }
  return "-"
}

export function EmployeeSalaryComponentSection({
  employeeId,
  items,
  availableComponents,
}: {
  employeeId: number
  items: EmployeeSalaryComponentRow[]
  availableComponents: AvailableComponent[]
}) {
  const [isPending, startTransition] = useTransition()
  const [formError, setFormError] = useState<string | null>(null)
  const [selectedComponentId, setSelectedComponentId] = useState<string>("")

  const selectedComponent = useMemo(
    () => availableComponents.find((c) => String(c.id) === selectedComponentId) ?? null,
    [availableComponents, selectedComponentId]
  )

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    startTransition(async () => {
      const result = await upsertEmployeeSalaryComponentAction(employeeId, undefined, formData)
      if (result?.error) {
        setFormError(result.error)
        toast.error(result.error)
      } else {
        setFormError(null)
        setSelectedComponentId("")
        toast.success("Komponen gaji pegawai berhasil disimpan.")
      }
    })
  }

  function handleToggleActive(row: EmployeeSalaryComponentRow) {
    startTransition(async () => {
      await toggleEmployeeSalaryComponentActiveAction(row.id, employeeId, !row.isActive)
      toast.success(row.isActive ? `"${row.name}" dinonaktifkan.` : `"${row.name}" diaktifkan.`)
    })
  }

  function handleDelete(row: EmployeeSalaryComponentRow) {
    startTransition(async () => {
      await deleteEmployeeSalaryComponentAction(row.id, employeeId)
      toast.success(`"${row.name}" berhasil dihapus.`)
    })
  }

  const columns: ColumnDef<EmployeeSalaryComponentRow, unknown>[] = [
    { accessorKey: "name", header: "Komponen" },
    {
      id: "category",
      header: "Kategori",
      accessorFn: (row) => CATEGORY_LABEL[row.category] ?? row.category,
    },
    {
      id: "value",
      header: "Nilai",
      cell: ({ row }) => valueLabel(row.original),
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
        <Button
          size="sm"
          variant="destructive"
          disabled={isPending}
          onClick={() => handleDelete(row.original)}
        >
          Hapus
        </Button>
      ),
    },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Komponen Gaji Pegawai</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <DataTable
          columns={columns}
          data={items}
          searchPlaceholder="Cari komponen..."
          emptyMessage="Belum ada komponen gaji yang diassign ke pegawai ini."
        />

        <form onSubmit={handleSubmit} className="grid gap-4 border-t pt-4 sm:grid-cols-3">
          <div className="grid gap-2">
            <Label>Komponen Gaji</Label>
            <Select
              name="salaryComponentId"
              value={selectedComponentId}
              onValueChange={(v) => setSelectedComponentId(v ?? "")}
              items={availableComponents.map((c) => ({ value: String(c.id), label: c.name }))}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Pilih komponen" />
              </SelectTrigger>
              <SelectContent>
                {availableComponents.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedComponent?.calculationType === "NOMINAL_TETAP" ? (
            <div className="grid gap-2">
              <Label htmlFor="amount">Nominal</Label>
              <RupiahInput key={selectedComponentId} id="amount" name="amount" />
            </div>
          ) : selectedComponent?.calculationType === "PERSENTASE" ? (
            <div className="grid gap-2">
              <Label>Nilai</Label>
              <p className="flex h-9 items-center text-sm text-muted-foreground">
                Otomatis {selectedComponent.percentageValue}% dari{" "}
                {selectedComponent.baseComponentName ?? "-"}
              </p>
            </div>
          ) : null}

          {formError ? <p className="text-destructive text-sm sm:col-span-3">{formError}</p> : null}
          <div className="flex items-end">
            <Button type="submit" disabled={isPending || !selectedComponentId}>
              {isPending ? "Menyimpan..." : "Tambah/Perbarui"}
            </Button>
          </div>
        </form>

        {availableComponents.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Belum ada komponen gaji aktif bertipe Nominal Tetap/Persentase di
            master data Komponen Gaji.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Komponen bertipe Kehadiran/Manual Per Periode tidak muncul di sini
            karena nilainya ditentukan tiap Proses Payroll, bukan nilai tetap
            per pegawai.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
