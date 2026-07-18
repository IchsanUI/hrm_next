"use client"

import { useTransition } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import type { Prisma } from "@prisma/client"
import { toast } from "sonner"

import { restoreEmployeeAction } from "@/server/actions/employees"
import { Button } from "@/components/ui/button"
import { DataTable } from "@/components/data-table"

type DeletedEmployeeRow = Prisma.EmployeeGetPayload<{
  include: { department: true; position: true }
}>

export function DeletedEmployeesTable({
  employees,
}: {
  employees: DeletedEmployeeRow[]
}) {
  const [isPending, startTransition] = useTransition()

  const columns: ColumnDef<DeletedEmployeeRow, unknown>[] = [
    { accessorKey: "employeeNumber", header: "NIP" },
    { accessorKey: "fullName", header: "Nama" },
    {
      id: "department",
      header: "Bagian",
      accessorFn: (row) => row.department.name,
    },
    {
      id: "reason",
      header: "Alasan",
      accessorFn: (row) => row.deleteReason ?? "-",
    },
    {
      id: "deletedBy",
      header: "Dihapus Oleh",
      accessorFn: (row) => row.deletedBy ?? "-",
    },
    {
      id: "actions",
      header: "Aksi",
      cell: ({ row }) => (
        <Button
          size="sm"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              try {
                await restoreEmployeeAction(row.original.id)
                toast.success("Pegawai berhasil dipulihkan.")
              } catch {
                toast.error("Gagal memulihkan pegawai.")
              }
            })
          }
        >
          Pulihkan
        </Button>
      ),
    },
  ]

  return (
    <DataTable
      columns={columns}
      data={employees}
      searchPlaceholder="Cari pegawai terhapus..."
      emptyMessage="Tidak ada data terhapus."
    />
  )
}
