"use client"

import { useState, useTransition, type FormEvent } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { toast } from "sonner"

import {
  createNationalHolidayAction,
  updateNationalHolidayAction,
  deleteNationalHolidayAction,
} from "@/server/actions/national-holidays"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DataTable } from "@/components/data-table"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type Holiday = { id: number; date: Date; name: string }

function formatDateInput(date: Date) {
  return date.toISOString().slice(0, 10)
}

function formatDateDisplay(date: Date) {
  return date.toLocaleDateString("id-ID", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  })
}

export function NationalHolidaysTable({ holidays }: { holidays: Holiday[] }) {
  const [dialogItem, setDialogItem] = useState<Holiday | "new" | null>(null)
  const [isPending, startTransition] = useTransition()
  const [formError, setFormError] = useState<string | null>(null)

  function openDialog(item: Holiday | "new") {
    setFormError(null)
    setDialogItem(item)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const isEdit = dialogItem !== null && dialogItem !== "new"
    const act = isEdit
      ? updateNationalHolidayAction.bind(null, dialogItem.id)
      : createNationalHolidayAction

    startTransition(async () => {
      const result = await act(undefined, formData)
      if (result?.error) {
        setFormError(result.error)
        toast.error(result.error)
      } else {
        setFormError(null)
        setDialogItem(null)
        toast.success(
          isEdit ? "Hari libur berhasil diperbarui." : "Hari libur berhasil ditambahkan."
        )
      }
    })
  }

  const columns: ColumnDef<Holiday, unknown>[] = [
    {
      id: "date",
      header: "Tanggal",
      accessorFn: (row) => formatDateDisplay(row.date),
    },
    { accessorKey: "name", header: "Nama Hari Libur" },
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
              startTransition(async () => {
                try {
                  await deleteNationalHolidayAction(row.original.id)
                  toast.success("Hari libur berhasil dihapus.")
                } catch {
                  toast.error("Gagal menghapus hari libur.")
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
          <h2 className="text-lg font-semibold">Hari Libur Nasional</h2>
          <p className="text-sm text-muted-foreground">
            Tanggal merah &amp; cuti bersama. Dipakai nanti untuk perhitungan hari
            kerja pada modul absensi dan pengajuan izin/cuti.
          </p>
        </div>
        <Button onClick={() => openDialog("new")}>Tambah Hari Libur</Button>
      </div>

      <DataTable
        columns={columns}
        data={holidays}
        searchPlaceholder="Cari hari libur..."
        emptyMessage="Belum ada data hari libur."
      />

      <Dialog
        open={dialogItem !== null}
        onOpenChange={(open) => !open && setDialogItem(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogItem === "new" ? "Tambah Hari Libur" : "Edit Hari Libur"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="date">Tanggal</Label>
              <Input
                id="date"
                name="date"
                type="date"
                defaultValue={
                  dialogItem && dialogItem !== "new"
                    ? formatDateInput(dialogItem.date)
                    : ""
                }
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="name">Nama Hari Libur</Label>
              <Input
                id="name"
                name="name"
                placeholder="Hari Raya Idul Fitri"
                defaultValue={
                  dialogItem && dialogItem !== "new" ? dialogItem.name : ""
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
