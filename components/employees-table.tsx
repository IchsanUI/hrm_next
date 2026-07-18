"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import type { ColumnDef } from "@tanstack/react-table"
import type { Prisma } from "@prisma/client"
import { toast } from "sonner"

import { softDeleteEmployeeAction } from "@/server/actions/employees"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { DataTable } from "@/components/data-table"
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

type EmployeeRow = Prisma.EmployeeGetPayload<{
  include: { department: true; position: true; employmentStatus: true }
}>

export function EmployeesTable({ employees }: { employees: EmployeeRow[] }) {
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [reason, setReason] = useState("")
  const [isPending, startTransition] = useTransition()

  const columns: ColumnDef<EmployeeRow, unknown>[] = [
    {
      id: "no",
      header: () => <div className="text-center">No</div>,
      cell: ({ row }) => (
        <div className="text-center">{row.index + 1}</div>
      ),
    },
    {
      id: "photo",
      header: "Foto",
      cell: ({ row }) => (
        <Avatar className="size-9 rounded-md after:rounded-md" size="default">
          {row.original.photoUrl ? (
            <AvatarImage
              src={row.original.photoUrl}
              className="rounded-md object-cover"
            />
          ) : null}
          <AvatarFallback className="rounded-md">
            {row.original.fullName.slice(0, 1)}
          </AvatarFallback>
        </Avatar>
      ),
    },
    { accessorKey: "employeeNumber", header: "NIP" },
    { accessorKey: "fullName", header: "Nama" },
    {
      id: "department",
      header: "Bagian",
      accessorFn: (row) => row.department.name,
    },
    {
      id: "position",
      header: "Jabatan",
      accessorFn: (row) => row.position.name,
    },
    {
      id: "status",
      header: "Status",
      accessorFn: (row) => row.employmentStatus.name,
      cell: ({ row }) => (
        <Badge variant="secondary">{row.original.employmentStatus.name}</Badge>
      ),
    },
    {
      id: "actions",
      header: "Aksi",
      cell: ({ row }) => (
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href={`/admin/pegawai/${row.original.publicId}/detail`} />}
          >
            Detail
          </Button>
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href={`/admin/pegawai/${row.original.publicId}`} />}
          >
            Edit
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              setDeletingId(row.original.id)
              setReason("")
            }}
          >
            Hapus
          </Button>
        </div>
      ),
    },
  ]

  return (
    <>
      <DataTable
        columns={columns}
        data={employees}
        searchPlaceholder="Cari NIP, nama, bagian, jabatan..."
        emptyMessage="Belum ada data pegawai."
        pageSize={10}
      />

      <AlertDialog
        open={deletingId !== null}
        onOpenChange={(open) => !open && setDeletingId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus data pegawai?</AlertDialogTitle>
            <AlertDialogDescription>
              Data akan dipindah ke Data Terhapus dan akun login pegawai
              dinonaktifkan. Anda bisa memulihkannya nanti.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            placeholder="Alasan penghapusan (opsional)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              disabled={isPending}
              onClick={() => {
                if (deletingId === null) return
                const id = deletingId
                startTransition(async () => {
                  try {
                    await softDeleteEmployeeAction(id, reason)
                    toast.success("Pegawai berhasil dihapus.")
                  } catch {
                    toast.error("Gagal menghapus pegawai.")
                  } finally {
                    setDeletingId(null)
                  }
                })
              }}
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
