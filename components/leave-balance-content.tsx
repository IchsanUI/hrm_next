"use client"

import { useActionState, useEffect, useRef, useState } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { toast } from "sonner"
import { Info, Pencil } from "lucide-react"

import {
  adjustLeaveBalanceAction,
  type LeaveBalanceFormState,
} from "@/server/actions/leave-balance"
import type { EmployeeLeaveBalanceRow } from "@/lib/leave-balance"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DataTable } from "@/components/data-table"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"

function remainingClassName(remaining: number) {
  if (remaining < 0) return "font-medium text-destructive"
  if (remaining === 0) return "font-medium text-amber-600 dark:text-amber-400"
  return "font-medium text-emerald-600 dark:text-emerald-400"
}

function AdjustDialog({
  row,
  open,
  onOpenChange,
}: {
  row: EmployeeLeaveBalanceRow
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [state, formAction, isPending] = useActionState<LeaveBalanceFormState, FormData>(
    adjustLeaveBalanceAction,
    undefined
  )
  const wasPending = useRef(false)

  useEffect(() => {
    if (!wasPending.current || isPending) {
      wasPending.current = isPending
      return
    }
    wasPending.current = isPending
    if (state?.error) {
      toast.error(state.error)
      return
    }
    toast.success(`Saldo cuti "${row.fullName}" berhasil diperbarui.`)
    onOpenChange(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPending, state])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Atur Saldo Cuti — {row.fullName}</DialogTitle>
          <DialogDescription>
            Jatah tahun {row.year} untuk {row.fullName}. Penyesuaian bisa
            negatif (potongan) atau positif (carry-over/bonus).
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="grid gap-3">
          <input type="hidden" name="employeeId" value={row.employeeId} />
          <input type="hidden" name="year" value={row.year} />
          <div className="grid gap-2">
            <Label htmlFor={`quota-${row.employeeId}`}>Jatah Cuti (hari)</Label>
            <Input
              id={`quota-${row.employeeId}`}
              name="quota"
              type="number"
              min={0}
              defaultValue={row.quota}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`adjustment-${row.employeeId}`}>Penyesuaian (hari)</Label>
            <Input
              id={`adjustment-${row.employeeId}`}
              name="adjustment"
              type="number"
              defaultValue={row.adjustment}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`note-${row.employeeId}`}>Catatan (opsional)</Label>
            <Textarea
              id={`note-${row.employeeId}`}
              name="note"
              defaultValue={row.note ?? ""}
              placeholder="Mis. carry-over dari tahun lalu"
            />
          </div>
          {state?.error ? <p className="text-destructive text-sm">{state.error}</p> : null}
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

function buildColumns(
  onAdjustClick: (row: EmployeeLeaveBalanceRow) => void
): ColumnDef<EmployeeLeaveBalanceRow, unknown>[] {
  return [
    { accessorKey: "fullName", header: "Nama Pegawai" },
    { accessorKey: "departmentName", header: "Departemen" },
    { accessorKey: "positionName", header: "Jabatan" },
    { accessorKey: "quota", header: "Jatah" },
    {
      accessorKey: "carryOverDays",
      header: "Akumulasi Tahun Lalu",
      cell: ({ row }) => {
        const { carryOverDays, carryOverActive, carryOverDeadline } = row.original
        if (carryOverDays === 0) return <span className="text-muted-foreground">-</span>
        if (!carryOverActive) {
          return (
            <span className="text-muted-foreground line-through" title="Sudah hangus, lewat tenggat">
              {carryOverDays} hari
            </span>
          )
        }
        return (
          <div>
            <span className="font-medium text-amber-600 dark:text-amber-400">
              +{carryOverDays} hari
            </span>
            <p className="text-[10px] text-muted-foreground">s/d {carryOverDeadline}</p>
          </div>
        )
      },
    },
    {
      accessorKey: "adjustment",
      header: "Penyesuaian",
      cell: ({ row }) => (
        <span className={row.original.adjustment !== 0 ? "font-medium" : undefined}>
          {row.original.adjustment > 0 ? `+${row.original.adjustment}` : row.original.adjustment}
        </span>
      ),
    },
    { accessorKey: "used", header: "Terpakai" },
    {
      accessorKey: "remaining",
      header: "Sisa",
      cell: ({ row }) =>
        row.original.blockedByCutiBesar ? (
          <span
            className="font-medium text-muted-foreground"
            title="Pegawai ini menjalani Cuti Besar tahun ini — Pasal 38 ayat 3 menghapus hak Cuti Tahunan di tahun yang sama."
          >
            0 (Cuti Besar)
          </span>
        ) : (
          <span className={remainingClassName(row.original.remaining)}>
            {row.original.remaining}
          </span>
        ),
    },
    {
      id: "actions",
      header: "Aksi",
      cell: ({ row }) => (
        <Button variant="outline" size="sm" onClick={() => onAdjustClick(row.original)}>
          <Pencil className="size-3.5" />
          Atur
        </Button>
      ),
    },
  ]
}

export function LeaveBalanceContent({
  balances,
  year,
  years,
  currentYear,
}: {
  balances: EmployeeLeaveBalanceRow[]
  year: number
  years: number[]
  currentYear: number
}) {
  const [adjusting, setAdjusting] = useState<EmployeeLeaveBalanceRow | null>(null)

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold">Saldo Cuti Pegawai</h1>
            {balances[0] ? (
              <Badge variant={balances[0].carryOverActive ? "default" : "secondary"}>
                {balances[0].carryOverActive
                  ? `Akumulasi aktif s/d ${balances[0].carryOverDeadline}`
                  : "Akumulasi tahun ini sudah hangus"}
              </Badge>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Jatah, penyesuaian, dan sisa cuti tahunan seluruh pegawai aktif.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-2">
            {years.map((y) => (
              <Button
                key={y}
                variant={y === year ? "default" : "outline"}
                size="sm"
                nativeButton={false}
                render={<a href={`/admin/saldo-cuti?year=${y}`} />}
              >
                {y}
                {y === currentYear ? " · Berjalan" : ""}
              </Button>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Jatah baru & akumulasi otomatis mengikuti tanggal hari ini — tidak
            perlu diatur manual.
          </p>
        </div>
      </div>

      <p className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
        <Info className="mr-1 inline size-3.5 align-text-bottom text-amber-500" />
        Sesuai Pasal 36: sisa cuti tahun sebelumnya yang tidak dijalani bisa
        diakumulasi ke tahun berjalan, maksimal 6 hari kerja, dan cuma berlaku
        sampai 31 Maret — lewat tanggal itu otomatis hangus. Kolom &quot;Sisa&quot;
        sudah memperhitungkan ini secara otomatis.
      </p>

      {balances.length > 0 ? (
        <div className="mb-4">
          <Badge variant="secondary">{balances.length} pegawai aktif</Badge>
        </div>
      ) : null}

      <DataTable
        columns={buildColumns(setAdjusting)}
        data={balances}
        searchPlaceholder="Cari nama pegawai..."
        emptyMessage="Belum ada data pegawai."
      />

      {adjusting ? (
        <AdjustDialog
          row={adjusting}
          open={adjusting !== null}
          onOpenChange={(open) => !open && setAdjusting(null)}
        />
      ) : null}
    </div>
  )
}
