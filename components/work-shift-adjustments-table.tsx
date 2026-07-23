"use client"

import { useState, useTransition, type FormEvent } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { toast } from "sonner"

import {
  createWorkShiftAdjustmentAction,
  updateWorkShiftAdjustmentAction,
  deleteWorkShiftAdjustmentAction,
} from "@/server/actions/work-shift-adjustments"
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type Adjustment = {
  id: number
  workShiftId: number
  name: string
  startDate: Date
  endDate: Date
  checkInTime: Date
  checkOutTime: Date
  workShift: { name: string }
}

type ShiftOption = { id: number; name: string }

function formatTime(date: Date) {
  return date.toISOString().slice(11, 16)
}

function formatDateInput(date: Date) {
  return date.toISOString().slice(0, 10)
}

function formatDateDisplay(date: Date) {
  return date.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })
}

export function WorkShiftAdjustmentsTable({
  adjustments,
  workShifts,
}: {
  adjustments: Adjustment[]
  workShifts: ShiftOption[]
}) {
  const [dialogItem, setDialogItem] = useState<Adjustment | "new" | null>(null)
  const [isPending, startTransition] = useTransition()
  const [formError, setFormError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  function openDialog(item: Adjustment | "new") {
    setFormError(null)
    setDialogItem(item)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const isEdit = dialogItem !== null && dialogItem !== "new"
    const act = isEdit
      ? updateWorkShiftAdjustmentAction.bind(null, dialogItem.id)
      : createWorkShiftAdjustmentAction

    startTransition(async () => {
      const result = await act(undefined, formData)
      if (result?.error) {
        setFormError(result.error)
        toast.error(result.error)
      } else {
        setFormError(null)
        setDialogItem(null)
        toast.success(isEdit ? "Penyesuaian berhasil diperbarui." : "Penyesuaian berhasil ditambahkan.")
      }
    })
  }

  const columns: ColumnDef<Adjustment, unknown>[] = [
    { accessorKey: "name", header: "Nama Penyesuaian" },
    {
      id: "shift",
      header: "Jam Kerja",
      accessorFn: (row) => row.workShift.name,
    },
    {
      id: "period",
      header: "Periode",
      accessorFn: (row) =>
        `${formatDateDisplay(row.startDate)} - ${formatDateDisplay(row.endDate)}`,
    },
    {
      id: "time",
      header: "Jam Masuk-Pulang",
      accessorFn: (row) => `${formatTime(row.checkInTime)}-${formatTime(row.checkOutTime)}`,
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
                try {
                  await deleteWorkShiftAdjustmentAction(row.original.id)
                  toast.success("Penyesuaian berhasil dihapus.")
                } catch {
                  const message = "Gagal menghapus penyesuaian."
                  setActionError(message)
                  toast.error(message)
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
        <div>
          <h2 className="text-lg font-semibold">Penyesuaian Jam Kerja</h2>
          <p className="text-sm text-muted-foreground">
            Jam kerja khusus untuk periode tertentu, mis. Ramadan atau hari
            besar lainnya. Dipakai nanti oleh modul absensi.
          </p>
        </div>
        <Button onClick={() => openDialog("new")}>Tambah Penyesuaian</Button>
      </div>

      {actionError ? (
        <p className="mb-2 text-destructive text-sm">{actionError}</p>
      ) : null}

      <DataTable
        columns={columns}
        data={adjustments}
        searchPlaceholder="Cari penyesuaian..."
        emptyMessage="Belum ada penyesuaian jam kerja."
        pageSize={5}
      />

      <Dialog
        open={dialogItem !== null}
        onOpenChange={(open) => !open && setDialogItem(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogItem === "new" ? "Tambah Penyesuaian Jam Kerja" : "Edit Penyesuaian Jam Kerja"}
            </DialogTitle>
            <DialogDescription>
              Selama periode ini, jam kerja shift terkait mengikuti jam yang
              ditentukan di sini.
            </DialogDescription>
          </DialogHeader>
          <form
            key={dialogItem && dialogItem !== "new" ? dialogItem.id : "new"}
            onSubmit={handleSubmit}
            className="grid gap-4"
          >
            <div className="grid gap-2">
              <Label htmlFor="name">Nama Penyesuaian</Label>
              <Input
                id="name"
                name="name"
                placeholder="Ramadan 1447H"
                defaultValue={
                  dialogItem && dialogItem !== "new" ? dialogItem.name : ""
                }
                required
              />
            </div>
            <div className="grid gap-2">
              <Label>Jam Kerja</Label>
              <Select
                name="workShiftId"
                defaultValue={
                  dialogItem && dialogItem !== "new"
                    ? String(dialogItem.workShiftId)
                    : undefined
                }
                items={workShifts.map((shift) => ({
                  value: String(shift.id),
                  label: shift.name,
                }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Pilih jam kerja" />
                </SelectTrigger>
                <SelectContent>
                  {workShifts.map((shift) => (
                    <SelectItem key={shift.id} value={String(shift.id)}>
                      {shift.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="startDate">Tanggal Mulai</Label>
                <Input
                  id="startDate"
                  name="startDate"
                  type="date"
                  defaultValue={
                    dialogItem && dialogItem !== "new"
                      ? formatDateInput(dialogItem.startDate)
                      : ""
                  }
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="endDate">Tanggal Selesai</Label>
                <Input
                  id="endDate"
                  name="endDate"
                  type="date"
                  defaultValue={
                    dialogItem && dialogItem !== "new"
                      ? formatDateInput(dialogItem.endDate)
                      : ""
                  }
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
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
