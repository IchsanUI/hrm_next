"use client"

import type { PayrollPeriodStatus } from "@prisma/client"
import { PAYROLL_STATUS_LABEL, PAYROLL_STATUS_BADGE_VARIANT } from "@/lib/payroll/status-labels"
import { useState } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { Download } from "lucide-react"

import { RincianDialog, type PayslipRow } from "@/components/payslip-list-table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DataTable } from "@/components/data-table"

export type PayslipBrowserRow = PayslipRow & {
  periodId: number
  periodLabel: string
  periodStatus: PayrollPeriodStatus
}

function formatRupiah(value: number) {
  return `Rp${Math.round(value).toLocaleString("id-ID")}`
}

export function EmployeePayslipBrowser({
  rows,
  variant = "admin",
}: {
  rows: PayslipBrowserRow[]
  // "self" — dipakai di halaman Slip Gaji pegawai sendiri (selalu berisi
  // periode LOCKED saja, lihat app/pegawai/slip-gaji/page.tsx) — kolom
  // Status Periode & rincian Bruto/Potongan disembunyikan karena
  // redundan/tidak perlu di ringkasan tabel (rinciannya tetap ada lewat
  // tombol Detail). "admin" (default) — semua kolom tampil seperti biasa,
  // dipakai di /admin/payroll/slip-gaji yang lintas pegawai & lintas status.
  variant?: "admin" | "self"
}) {
  const [selected, setSelected] = useState<PayslipBrowserRow | null>(null)
  const isSelf = variant === "self"

  const columns: ColumnDef<PayslipBrowserRow, unknown>[] = [
    { accessorKey: "employeeNumber", header: "NIP" },
    { accessorKey: "employeeName", header: "Nama" },
    { accessorKey: "periodLabel", header: "Periode" },
    ...(isSelf
      ? []
      : ([
          {
            id: "grossPay",
            header: "Bruto",
            accessorFn: (row) => formatRupiah(row.grossPay),
          },
          {
            id: "totalDeduction",
            header: "Potongan",
            accessorFn: (row) => formatRupiah(row.totalDeduction),
          },
        ] satisfies ColumnDef<PayslipBrowserRow, unknown>[])),
    {
      id: "netPay",
      header: "Netto",
      accessorFn: (row) => formatRupiah(row.netPay),
      cell: ({ row }) => <span className="font-medium">{formatRupiah(row.original.netPay)}</span>,
    },
    ...(isSelf
      ? []
      : ([
          {
            id: "status",
            header: "Status Periode",
            accessorFn: (row) => PAYROLL_STATUS_LABEL[row.periodStatus],
            cell: ({ row }) => (
              <Badge variant={PAYROLL_STATUS_BADGE_VARIANT[row.original.periodStatus]}>
                {PAYROLL_STATUS_LABEL[row.original.periodStatus]}
              </Badge>
            ),
          },
        ] satisfies ColumnDef<PayslipBrowserRow, unknown>[])),
    {
      id: "actions",
      header: "Aksi",
      cell: ({ row }) => (
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setSelected(row.original)}>
            Detail
          </Button>
          {row.original.periodStatus === "LOCKED" ? (
            <Button
              size="sm"
              variant="outline"
              nativeButton={false}
              render={<a href={`/api/payroll/slip-gaji/${row.original.id}/pdf`} download />}
            >
              <Download className="size-3.5" />
              Unduh
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              disabled
              title="Slip gaji baru bisa diunduh setelah periode payroll disetujui & dikunci."
            >
              <Download className="size-3.5" />
              Unduh
            </Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <>
      <DataTable
        columns={columns}
        data={rows}
        searchPlaceholder="Cari nama atau NIP..."
        emptyMessage="Belum ada slip gaji pada periode yang dipilih."
        pageSize={20}
      />
      <RincianDialog payslip={selected} onOpenChange={(open) => !open && setSelected(null)} />
    </>
  )
}
