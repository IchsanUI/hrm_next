"use client"

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
  periodStatus: "DRAFT" | "PENDING_APPROVAL" | "LOCKED"
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

function formatRupiah(value: number) {
  return `Rp${Math.round(value).toLocaleString("id-ID")}`
}

export function EmployeePayslipBrowser({ rows }: { rows: PayslipBrowserRow[] }) {
  const [selected, setSelected] = useState<PayslipBrowserRow | null>(null)

  const columns: ColumnDef<PayslipBrowserRow, unknown>[] = [
    { accessorKey: "employeeNumber", header: "NIP" },
    { accessorKey: "employeeName", header: "Nama" },
    { accessorKey: "periodLabel", header: "Periode" },
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
    {
      id: "netPay",
      header: "Netto",
      accessorFn: (row) => formatRupiah(row.netPay),
      cell: ({ row }) => <span className="font-medium">{formatRupiah(row.original.netPay)}</span>,
    },
    {
      id: "status",
      header: "Status Periode",
      accessorFn: (row) => STATUS_LABEL[row.periodStatus],
      cell: ({ row }) => (
        <Badge variant={STATUS_BADGE_VARIANT[row.original.periodStatus]}>
          {STATUS_LABEL[row.original.periodStatus]}
        </Badge>
      ),
    },
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
