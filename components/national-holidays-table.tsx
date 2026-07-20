"use client"

import { useRef, useState, useTransition, type FormEvent } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { toast } from "sonner"

import {
  createNationalHolidayAction,
  updateNationalHolidayAction,
  deleteNationalHolidayAction,
  importNationalHolidaysAction,
} from "@/server/actions/national-holidays"
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

type Holiday = { id: number; date: Date; name: string; isOfficeOpen: boolean }

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

  const [importOpen, setImportOpen] = useState(false)
  const [isImporting, startImportTransition] = useTransition()
  const [importError, setImportError] = useState<string | null>(null)
  const importFormRef = useRef<HTMLFormElement>(null)

  function openDialog(item: Holiday | "new") {
    setFormError(null)
    setDialogItem(item)
  }

  function handleImportSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    startImportTransition(async () => {
      const result = await importNationalHolidaysAction(undefined, formData)
      if (!result) return
      if (!result.success) {
        setImportError(result.error)
        toast.error(result.error)
        return
      }
      setImportError(null)
      setImportOpen(false)
      importFormRef.current?.reset()
      const parts = [`${result.imported} hari libur berhasil diimpor.`]
      if (result.skipped > 0) parts.push(`${result.skipped} dilewati (tanggal sudah ada).`)
      toast.success(parts.join(" "))
      if (result.errors.length > 0) {
        toast.warning(`${result.errors.length} baris dilewati karena tidak valid.`, {
          description: result.errors.slice(0, 5).join(" "),
        })
      }
    })
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
      id: "isOfficeOpen",
      header: "Kantor Tetap Masuk",
      cell: ({ row }) =>
        row.original.isOfficeOpen ? (
          <Badge variant="secondary">Tetap Masuk</Badge>
        ) : (
          <span className="text-muted-foreground">-</span>
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
        <div className="flex gap-2">
          <Button
            variant="outline"
            nativeButton={false}
            render={<a href="/api/master-data/hari-libur/template" />}
          >
            Unduh Template
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setImportError(null)
              setImportOpen(true)
            }}
          >
            Import Excel
          </Button>
          <Button onClick={() => openDialog("new")}>Tambah Hari Libur</Button>
        </div>
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
          <form
            key={dialogItem === "new" || dialogItem === null ? "new" : dialogItem.id}
            onSubmit={handleSubmit}
            className="grid gap-4"
          >
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
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                name="isOfficeOpen"
                className="mt-0.5"
                defaultChecked={
                  dialogItem && dialogItem !== "new" ? dialogItem.isOfficeOpen : false
                }
              />
              <span>
                Kantor tetap masuk (cuti bersama, tapi bukan hari libur beneran)
                <span className="block text-xs text-muted-foreground">
                  Kalau dicentang, tanggal ini TIDAK dikecualikan dari
                  perhitungan hari kerja Izin Cuti.
                </span>
              </span>
            </label>
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

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Hari Libur dari Excel</DialogTitle>
          </DialogHeader>
          <form ref={importFormRef} onSubmit={handleImportSubmit} className="grid gap-4">
            <p className="text-sm text-muted-foreground">
              Unduh template terlebih dahulu, isi datanya, lalu unggah file di
              sini. Tanggal yang sudah ada di sistem akan otomatis dilewati.
            </p>
            <div className="grid gap-2">
              <Label htmlFor="import-file">File Excel (.xlsx)</Label>
              <Input id="import-file" name="file" type="file" accept=".xlsx" required />
            </div>
            {importError ? (
              <p className="text-destructive text-sm">{importError}</p>
            ) : null}
            <DialogFooter>
              <Button type="submit" disabled={isImporting}>
                {isImporting ? "Mengimpor..." : "Import"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
