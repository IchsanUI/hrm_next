"use client"

import { useTransition } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { toast } from "sonner"

import { setHrAdminAccessAction } from "@/server/actions/access"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { DataTable } from "@/components/data-table"

type AccessRow = {
  id: number
  fullName: string
  employeeNumber: string
  position: string
  department: string
  role: "SUPER_ADMIN" | "HR_ADMIN" | "EMPLOYEE"
}

const ROLE_LABEL: Record<AccessRow["role"], string> = {
  SUPER_ADMIN: "Super Admin",
  HR_ADMIN: "HR Admin",
  EMPLOYEE: "Pegawai",
}

export function AccessHrTable({ users }: { users: AccessRow[] }) {
  const [isPending, startTransition] = useTransition()

  const columns: ColumnDef<AccessRow, unknown>[] = [
    { accessorKey: "employeeNumber", header: "NIP" },
    { accessorKey: "fullName", header: "Nama" },
    { accessorKey: "position", header: "Jabatan" },
    { accessorKey: "department", header: "Bagian" },
    {
      id: "role",
      header: "Role",
      accessorFn: (row) => ROLE_LABEL[row.role],
      cell: ({ row }) => (
        <Badge variant={row.original.role === "HR_ADMIN" ? "default" : "secondary"}>
          {ROLE_LABEL[row.original.role]}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: "Aksi",
      cell: ({ row }) => {
        if (row.original.role === "SUPER_ADMIN") {
          return <span className="text-sm text-muted-foreground">-</span>
        }
        const isHrAdmin = row.original.role === "HR_ADMIN"
        return (
          <Button
            size="sm"
            variant={isHrAdmin ? "destructive" : "default"}
            disabled={isPending}
            onClick={() => {
              startTransition(async () => {
                const result = await setHrAdminAccessAction(row.original.id, !isHrAdmin)
                if (result?.error) {
                  toast.error(result.error)
                } else {
                  toast.success(
                    isHrAdmin
                      ? `Akses HR Admin ${row.original.fullName} dicabut.`
                      : `${row.original.fullName} sekarang jadi HR Admin.`
                  )
                }
              })
            }}
          >
            {isHrAdmin ? "Cabut Akses HR Admin" : "Jadikan HR Admin"}
          </Button>
        )
      },
    },
  ]

  return (
    <DataTable
      columns={columns}
      data={users}
      searchPlaceholder="Cari nama, NIP, bagian..."
      emptyMessage="Belum ada akun pegawai."
    />
  )
}
