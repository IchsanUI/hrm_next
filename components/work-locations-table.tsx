"use client"

import { useState, useTransition, type FormEvent } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { toast } from "sonner"

import {
  createWorkLocationAction,
  updateWorkLocationAction,
  deleteWorkLocationAction,
} from "@/server/actions/work-locations"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { DataTable } from "@/components/data-table"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type WorkLocation = {
  id: number
  name: string
  address: string | null
  latitude: number | null
  longitude: number | null
  geofenceRadius: number
}

export function WorkLocationsTable({
  workLocations,
}: {
  workLocations: WorkLocation[]
}) {
  const [dialogItem, setDialogItem] = useState<WorkLocation | "new" | null>(null)
  const [isPending, startTransition] = useTransition()
  const [formError, setFormError] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  function openDialog(item: WorkLocation | "new") {
    setFormError(null)
    setDialogItem(item)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const isEdit = dialogItem !== null && dialogItem !== "new"
    const act = isEdit
      ? updateWorkLocationAction.bind(null, dialogItem.id)
      : createWorkLocationAction

    startTransition(async () => {
      const result = await act(undefined, formData)
      if (result?.error) {
        setFormError(result.error)
        toast.error(result.error)
      } else {
        setFormError(null)
        setDialogItem(null)
        toast.success(isEdit ? "Lokasi kerja berhasil diperbarui." : "Lokasi kerja berhasil ditambahkan.")
      }
    })
  }

  const columns: ColumnDef<WorkLocation, unknown>[] = [
    { accessorKey: "name", header: "Nama" },
    {
      accessorKey: "address",
      header: "Alamat",
      cell: ({ row }) => (
        <span className="line-clamp-2 max-w-xs">
          {row.original.address || "-"}
        </span>
      ),
    },
    {
      header: "Latitude",
      cell: ({ row }) => row.original.latitude ?? "-",
    },
    {
      header: "Longitude",
      cell: ({ row }) => row.original.longitude ?? "-",
    },
    {
      header: "Radius Geofence",
      cell: ({ row }) => `${row.original.geofenceRadius}m`,
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
                const result = await deleteWorkLocationAction(row.original.id)
                if (result?.error) {
                  setDeleteError(result.error)
                  toast.error(result.error)
                } else {
                  toast.success("Lokasi kerja berhasil dihapus.")
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
        <h2 className="text-lg font-semibold">Daftar Lokasi Kerja</h2>
        <Button onClick={() => openDialog("new")}>Tambah Lokasi Kerja</Button>
      </div>

      {deleteError ? (
        <p className="mb-2 text-destructive text-sm">{deleteError}</p>
      ) : null}

      <DataTable
        columns={columns}
        data={workLocations}
        searchPlaceholder="Cari lokasi kerja..."
        emptyMessage="Belum ada data lokasi kerja."
      />

      <Dialog
        open={dialogItem !== null}
        onOpenChange={(open) => !open && setDialogItem(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogItem === "new" ? "Tambah Lokasi Kerja" : "Edit Lokasi Kerja"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Nama Lokasi</Label>
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
              <Label htmlFor="address">Detail Alamat</Label>
              <Textarea
                id="address"
                name="address"
                placeholder="Jl. Contoh No. 1, Kecamatan, Kabupaten"
                defaultValue={
                  dialogItem && dialogItem !== "new"
                    ? dialogItem.address ?? undefined
                    : undefined
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="latitude">Latitude</Label>
                <Input
                  id="latitude"
                  name="latitude"
                  type="number"
                  step="any"
                  placeholder="-7.156800"
                  defaultValue={
                    dialogItem && dialogItem !== "new"
                      ? dialogItem.latitude ?? undefined
                      : undefined
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="longitude">Longitude</Label>
                <Input
                  id="longitude"
                  name="longitude"
                  type="number"
                  step="any"
                  placeholder="112.654200"
                  defaultValue={
                    dialogItem && dialogItem !== "new"
                      ? dialogItem.longitude ?? undefined
                      : undefined
                  }
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="geofenceRadius">Radius Geofence (meter)</Label>
              <Input
                id="geofenceRadius"
                name="geofenceRadius"
                type="number"
                step="any"
                min={1}
                placeholder="100"
                defaultValue={
                  dialogItem && dialogItem !== "new" ? dialogItem.geofenceRadius : 100
                }
              />
              <p className="text-xs text-muted-foreground">
                Jarak dari titik ini yang masih dianggap &quot;di lokasi&quot; saat
                dicocokkan otomatis dengan lokasi pengajuan izin pegawai.
              </p>
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
