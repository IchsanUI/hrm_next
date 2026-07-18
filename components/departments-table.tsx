"use client"

import { useState, useTransition, type FormEvent } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { toast } from "sonner"

import {
  createDepartmentAction,
  updateDepartmentAction,
  deleteDepartmentAction,
} from "@/server/actions/departments"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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

type Department = {
  id: number
  name: string
  code: string
  headEmployeeId: number | null
  headEmployee: { fullName: string } | null
}
type EmployeeOption = { id: number; fullName: string }

export function DepartmentsTable({
  departments,
  employees,
}: {
  departments: Department[]
  employees: EmployeeOption[]
}) {
  const [dialogItem, setDialogItem] = useState<Department | "new" | null>(null)
  const [isPending, startTransition] = useTransition()
  const [formError, setFormError] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  function openDialog(item: Department | "new") {
    setFormError(null)
    setDialogItem(item)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const isEdit = dialogItem !== null && dialogItem !== "new"
    const act = isEdit
      ? updateDepartmentAction.bind(null, dialogItem.id)
      : createDepartmentAction

    startTransition(async () => {
      const result = await act(undefined, formData)
      if (result?.error) {
        setFormError(result.error)
        toast.error(result.error)
      } else {
        setFormError(null)
        setDialogItem(null)
        toast.success(isEdit ? "Bagian berhasil diperbarui." : "Bagian berhasil ditambahkan.")
      }
    })
  }

  const columns: ColumnDef<Department, unknown>[] = [
    { accessorKey: "code", header: "Kode" },
    { accessorKey: "name", header: "Nama Bagian" },
    {
      id: "head",
      header: "Kepala Bagian",
      accessorFn: (row) => row.headEmployee?.fullName ?? "-",
    },
    {
      id: "actions",
      header: "Aksi",
      cell: ({ row }) => (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => openDialog(row.original)}
          >
            Edit
          </Button>
          <Button
            size="sm"
            variant="destructive"
            disabled={isPending}
            onClick={() => {
              setDeleteError(null)
              startTransition(async () => {
                const result = await deleteDepartmentAction(row.original.id)
                if (result?.error) {
                  setDeleteError(result.error)
                  toast.error(result.error)
                } else {
                  toast.success("Bagian berhasil dihapus.")
                }
              })
            }}
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
        <h2 className="text-lg font-semibold">Daftar Bagian</h2>
        <Button onClick={() => openDialog("new")}>Tambah Bagian</Button>
      </div>

      {deleteError ? (
        <p className="mb-2 text-destructive text-sm">{deleteError}</p>
      ) : null}

      <DataTable
        columns={columns}
        data={departments}
        searchPlaceholder="Cari bagian..."
        emptyMessage="Belum ada data bagian."
      />

      <Dialog
        open={dialogItem !== null}
        onOpenChange={(open) => !open && setDialogItem(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogItem === "new" ? "Tambah Bagian" : "Edit Bagian"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="code">Kode Bagian</Label>
              <Input
                id="code"
                name="code"
                defaultValue={
                  dialogItem && dialogItem !== "new" ? dialogItem.code : ""
                }
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="name">Nama Bagian</Label>
              <Input
                id="name"
                name="name"
                defaultValue={
                  dialogItem && dialogItem !== "new" ? dialogItem.name : ""
                }
                required
              />
            </div>
            <div className="grid gap-2">
              <Label>Kepala Bagian</Label>
              <Select
                name="headEmployeeId"
                defaultValue={
                  dialogItem && dialogItem !== "new" && dialogItem.headEmployeeId
                    ? String(dialogItem.headEmployeeId)
                    : ""
                }
                items={employees.map((employee) => ({
                  value: String(employee.id),
                  label: employee.fullName,
                }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Tidak ditentukan" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((employee) => (
                    <SelectItem key={employee.id} value={String(employee.id)}>
                      {employee.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {formError ? (
              <p className="text-destructive text-sm">{formError}</p>
            ) : null}
            <DialogFooter>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Menyimpan..." : "Simpan"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
