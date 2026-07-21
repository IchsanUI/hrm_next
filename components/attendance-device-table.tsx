"use client"

import { useState, useTransition, type FormEvent } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { toast } from "sonner"

import {
  createAttendanceDeviceAction,
  updateAttendanceDeviceAction,
  deleteAttendanceDeviceAction,
  testAttendanceDeviceConnectionAction,
} from "@/server/actions/attendance"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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

type Device = {
  id: number
  name: string
  ip: string
  loginUser: string
  loginPass: string
  active: boolean
}

export function AttendanceDeviceTable({ devices }: { devices: Device[] }) {
  const [dialogItem, setDialogItem] = useState<Device | "new" | null>(null)
  const [isPending, startTransition] = useTransition()
  const [formError, setFormError] = useState<string | null>(null)

  const [isTesting, startTestTransition] = useTransition()
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)

  function openDialog(item: Device | "new") {
    setFormError(null)
    setTestResult(null)
    setDialogItem(item)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const isEdit = dialogItem !== null && dialogItem !== "new"
    const act = isEdit
      ? updateAttendanceDeviceAction.bind(null, dialogItem.id)
      : createAttendanceDeviceAction

    startTransition(async () => {
      const result = await act(undefined, formData)
      if (result?.error) {
        setFormError(result.error)
        toast.error(result.error)
      } else {
        setFormError(null)
        setDialogItem(null)
        toast.success(isEdit ? "Mesin absensi berhasil diperbarui." : "Mesin absensi berhasil ditambahkan.")
      }
    })
  }

  function handleTestConnection(event: React.MouseEvent<HTMLButtonElement>) {
    const form = event.currentTarget.closest("form")
    if (!form) return
    const formData = new FormData(form)
    setTestResult(null)
    startTestTransition(async () => {
      const result = await testAttendanceDeviceConnectionAction(undefined, formData)
      setTestResult(result ?? null)
    })
  }

  const columns: ColumnDef<Device, unknown>[] = [
    { accessorKey: "name", header: "Nama Lokasi/Mesin" },
    { accessorKey: "ip", header: "IP" },
    { accessorKey: "loginUser", header: "Username Login" },
    {
      id: "active",
      header: "Status",
      cell: ({ row }) =>
        row.original.active ? (
          <Badge>Aktif</Badge>
        ) : (
          <Badge variant="secondary">Nonaktif</Badge>
        ),
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
              startTransition(async () => {
                try {
                  await deleteAttendanceDeviceAction(row.original.id)
                  toast.success("Mesin absensi berhasil dihapus.")
                } catch {
                  toast.error("Gagal menghapus mesin absensi.")
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
          <h2 className="text-lg font-semibold">Mesin Fingerprint</h2>
          <p className="text-sm text-muted-foreground">
            Daftar mesin absensi (lokasi, IP, kredensial login) yang dipakai buat mengambil data.
          </p>
        </div>
        <Button onClick={() => openDialog("new")}>Tambah Mesin</Button>
      </div>

      <DataTable
        columns={columns}
        data={devices}
        searchPlaceholder="Cari nama lokasi/mesin..."
        emptyMessage="Belum ada mesin absensi terdaftar."
      />

      <Dialog open={dialogItem !== null} onOpenChange={(open) => !open && setDialogItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialogItem === "new" ? "Tambah Mesin Absensi" : "Edit Mesin Absensi"}</DialogTitle>
          </DialogHeader>
          <form
            key={dialogItem === "new" || dialogItem === null ? "new" : dialogItem.id}
            onSubmit={handleSubmit}
            className="grid gap-4"
          >
            <div className="grid gap-2">
              <Label htmlFor="name">Nama Lokasi/Mesin</Label>
              <Input
                id="name"
                name="name"
                placeholder="Pusat"
                defaultValue={dialogItem && dialogItem !== "new" ? dialogItem.name : ""}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ip">IP Mesin</Label>
              <Input
                id="ip"
                name="ip"
                placeholder="10.77.1.50"
                defaultValue={dialogItem && dialogItem !== "new" ? dialogItem.ip : ""}
                required
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="loginUser">Username Login</Label>
                <Input
                  id="loginUser"
                  name="loginUser"
                  defaultValue={dialogItem && dialogItem !== "new" ? dialogItem.loginUser : ""}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="loginPass">Password Login</Label>
                <Input
                  id="loginPass"
                  name="loginPass"
                  type="password"
                  defaultValue={dialogItem && dialogItem !== "new" ? dialogItem.loginPass : ""}
                  required
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="active"
                defaultChecked={dialogItem && dialogItem !== "new" ? dialogItem.active : true}
              />
              Aktif (ikut disinkron saat &quot;Ambil Data Mesin&quot;)
            </label>

            {testResult ? (
              <p className={`text-sm ${testResult.ok ? "text-emerald-600" : "text-destructive"}`}>
                {testResult.message}
              </p>
            ) : null}
            {formError ? <p className="text-destructive text-sm">{formError}</p> : null}

            <DialogFooter className="gap-2 sm:justify-between">
              <Button
                type="button"
                variant="outline"
                disabled={isTesting}
                onClick={handleTestConnection}
              >
                {isTesting ? "Menguji..." : "Test Koneksi"}
              </Button>
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
