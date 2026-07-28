"use client"

import Link from "next/link"
import { useState, useTransition, type FormEvent } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { toast } from "sonner"

import { createPayrollPeriodAction, deletePayrollPeriodAction } from "@/server/actions/payroll-period"
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

export type PayrollPeriodRow = {
  id: number
  year: number
  month: number
  periodStart: string
  periodEnd: string
  status: "DRAFT" | "PENDING_APPROVAL" | "LOCKED"
  payslipCount: number
}

const STATUS_LABEL = {
  DRAFT: "Draft",
  PENDING_APPROVAL: "Menunggu Approval",
  LOCKED: "Dikunci",
} as const

const STATUS_BADGE_VARIANT = {
  DRAFT: "outline",
  PENDING_APPROVAL: "secondary",
  LOCKED: "default",
} as const

const MONTH_NAMES = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
]

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })
}

function NewPeriodDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const now = new Date()

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    startTransition(async () => {
      const result = await createPayrollPeriodAction(undefined, formData)
      if (result?.error) {
        setError(result.error)
        toast.error(result.error)
      } else {
        setError(null)
        onOpenChange(false)
        toast.success("Periode payroll berhasil dibuat.")
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Buat Periode Payroll</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <p className="text-sm text-muted-foreground">
            Periode selalu tanggal 21 bulan sebelumnya s/d tanggal 20 bulan
            yang dipilih (mis. bulan Agustus = 21 Juli s/d 20 Agustus).
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Bulan</Label>
              <Select
                name="month"
                defaultValue={String(now.getMonth() + 1)}
                items={MONTH_NAMES.map((label, index) => ({ value: String(index + 1), label }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Pilih bulan" />
                </SelectTrigger>
                <SelectContent>
                  {MONTH_NAMES.map((label, index) => (
                    <SelectItem key={label} value={String(index + 1)}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="year">Tahun</Label>
              <Input id="year" name="year" type="number" defaultValue={now.getFullYear()} required />
            </div>
          </div>
          {error ? <p className="text-destructive text-sm">{error}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Menyimpan..." : "Buat Periode"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function PayrollPeriodTable({ periods }: { periods: PayrollPeriodRow[] }) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deletingItem, setDeletingItem] = useState<PayrollPeriodRow | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleDelete() {
    if (!deletingItem) return
    const item = deletingItem
    startTransition(async () => {
      const result = await deletePayrollPeriodAction(item.id)
      if (result?.error) {
        toast.error(result.error)
      } else {
        toast.success("Periode payroll berhasil dihapus.")
        setDeletingItem(null)
      }
    })
  }

  const columns: ColumnDef<PayrollPeriodRow, unknown>[] = [
    {
      id: "period",
      header: "Periode",
      accessorFn: (row) => `${MONTH_NAMES[row.month - 1]} ${row.year}`,
    },
    {
      id: "range",
      header: "Cut-off",
      cell: ({ row }) => `${formatDate(row.original.periodStart)} — ${formatDate(row.original.periodEnd)}`,
    },
    {
      id: "payslipCount",
      header: "Jumlah Payslip",
      accessorFn: (row) => row.payslipCount,
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={STATUS_BADGE_VARIANT[row.original.status]}>
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
            size="sm"
            variant="outline"
            render={<Link href={`/admin/payroll/proses/${row.original.id}`} />}
            nativeButton={false}
          >
            Buka
          </Button>
          {row.original.status === "DRAFT" ? (
            <Button
              size="sm"
              variant="destructive"
              disabled={isPending}
              onClick={() => setDeletingItem(row.original)}
            >
              Hapus
            </Button>
          ) : null}
        </div>
      ),
    },
  ]

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Daftar Periode Payroll</h2>
        <Button onClick={() => setDialogOpen(true)}>Buat Periode</Button>
      </div>

      <DataTable
        columns={columns}
        data={periods}
        searchPlaceholder="Cari periode..."
        emptyMessage="Belum ada periode payroll."
      />

      <NewPeriodDialog open={dialogOpen} onOpenChange={setDialogOpen} />

      <AlertDialog open={deletingItem !== null} onOpenChange={(open) => !open && setDeletingItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus periode payroll?</AlertDialogTitle>
            <AlertDialogDescription>
              Periode {deletingItem ? `${MONTH_NAMES[deletingItem.month - 1]} ${deletingItem.year}` : ""} beserta
              seluruh payslip di dalamnya akan dihapus permanen.
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
