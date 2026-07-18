"use client"

import { useState, useTransition, type FormEvent } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { toast } from "sonner"

import {
  createWorkShiftAction,
  updateWorkShiftAction,
  deleteWorkShiftAction,
} from "@/server/actions/work-shifts"
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

type WorkShift = {
  id: number
  name: string
  type: "PEGAWAI" | "OUTSOURCING"
  checkInTime: Date
  checkOutTime: Date
}

const TYPE_LABEL: Record<WorkShift["type"], string> = {
  PEGAWAI: "Jam Pegawai",
  OUTSOURCING: "Jam Outsourcing",
}

function formatTime(date: Date) {
  return date.toISOString().slice(11, 16)
}

export function WorkShiftsTable({ workShifts }: { workShifts: WorkShift[] }) {
  const [dialogItem, setDialogItem] = useState<WorkShift | "new" | null>(null)
  const [isPending, startTransition] = useTransition()
  const [formError, setFormError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  function openDialog(item: WorkShift | "new") {
    setFormError(null)
    setDialogItem(item)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const isEdit = dialogItem !== null && dialogItem !== "new"
    const act = isEdit
      ? updateWorkShiftAction.bind(null, dialogItem.id)
      : createWorkShiftAction

    startTransition(async () => {
      const result = await act(undefined, formData)
      if (result?.error) {
        setFormError(result.error)
        toast.error(result.error)
      } else {
        setFormError(null)
        setDialogItem(null)
        toast.success(isEdit ? "Jam kerja berhasil diperbarui." : "Jam kerja berhasil ditambahkan.")
      }
    })
  }

  const columns: ColumnDef<WorkShift, unknown>[] = [
    { accessorKey: "name", header: "Nama Shift" },
    {
      id: "type",
      header: "Tipe",
      accessorFn: (row) => TYPE_LABEL[row.type],
      cell: ({ row }) => (
        <Badge variant={row.original.type === "PEGAWAI" ? "secondary" : "outline"}>
          {TYPE_LABEL[row.original.type]}
        </Badge>
      ),
    },
    {
      id: "checkInTime",
      header: "Jam Masuk",
      accessorFn: (row) => formatTime(row.checkInTime),
    },
    {
      id: "checkOutTime",
      header: "Jam Pulang",
      accessorFn: (row) => formatTime(row.checkOutTime),
    },
    {
      id: "actions",
      header: "Aksi",
      cell: ({ row }) => (
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => openDialog(row.original)}>
            Edit
          </Button>
          <Button
            size="sm"
            variant="destructive"
            disabled={isPending}
            onClick={() => {
              setActionError(null)
              startTransition(async () => {
                const result = await deleteWorkShiftAction(row.original.id)
                if (result?.error) {
                  setActionError(result.error)
                  toast.error(result.error)
                } else {
                  toast.success("Jam kerja berhasil dihapus.")
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
        <h2 className="text-lg font-semibold">Daftar Jam Kerja</h2>
        <Button onClick={() => openDialog("new")}>Tambah Jam Kerja</Button>
      </div>

      {actionError ? (
        <p className="mb-2 text-destructive text-sm">{actionError}</p>
      ) : null}

      <DataTable
        columns={columns}
        data={workShifts}
        searchPlaceholder="Cari jam kerja..."
        emptyMessage="Belum ada data jam kerja."
      />

      <Dialog
        open={dialogItem !== null}
        onOpenChange={(open) => !open && setDialogItem(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogItem === "new" ? "Tambah Jam Kerja" : "Edit Jam Kerja"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Nama Shift</Label>
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
              <Label>Tipe</Label>
              <Select
                name="type"
                defaultValue={
                  dialogItem && dialogItem !== "new" ? dialogItem.type : "PEGAWAI"
                }
                items={[
                  { value: "PEGAWAI", label: "Jam Pegawai" },
                  { value: "OUTSOURCING", label: "Jam Outsourcing" },
                ]}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Pilih tipe" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PEGAWAI">Jam Pegawai</SelectItem>
                  <SelectItem value="OUTSOURCING">Jam Outsourcing</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="checkInTime">Jam Masuk</Label>
              <Input
                id="checkInTime"
                name="checkInTime"
                type="time"
                defaultValue={
                  dialogItem && dialogItem !== "new"
                    ? formatTime(dialogItem.checkInTime)
                    : ""
                }
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="checkOutTime">Jam Pulang</Label>
              <Input
                id="checkOutTime"
                name="checkOutTime"
                type="time"
                defaultValue={
                  dialogItem && dialogItem !== "new"
                    ? formatTime(dialogItem.checkOutTime)
                    : ""
                }
                required
              />
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
