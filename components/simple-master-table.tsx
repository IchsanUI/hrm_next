"use client"

import { useState, useTransition, type FormEvent } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { toast } from "sonner"

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

type Item = { id: number; name: string }
type MasterDataState = { error?: string; success?: boolean } | undefined

export function SimpleMasterTable({
  title,
  addLabel = "Tambah",
  items,
  createAction,
  updateAction,
  deleteAction,
}: {
  title: string
  addLabel?: string
  items: Item[]
  createAction: (
    state: MasterDataState,
    formData: FormData
  ) => Promise<MasterDataState>
  updateAction: (
    id: number,
    state: MasterDataState,
    formData: FormData
  ) => Promise<MasterDataState>
  deleteAction: (id: number) => Promise<MasterDataState>
}) {
  const [dialogItem, setDialogItem] = useState<Item | "new" | null>(null)
  const [isPending, startTransition] = useTransition()
  const [formError, setFormError] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  function openDialog(item: Item | "new") {
    setFormError(null)
    setDialogItem(item)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const isEdit = dialogItem !== null && dialogItem !== "new"
    const act = isEdit ? updateAction.bind(null, dialogItem.id) : createAction

    startTransition(async () => {
      const result = await act(undefined, formData)
      if (result?.error) {
        setFormError(result.error)
        toast.error(result.error)
      } else {
        setFormError(null)
        setDialogItem(null)
        toast.success(isEdit ? "Data berhasil diperbarui." : "Data berhasil ditambahkan.")
      }
    })
  }

  const columns: ColumnDef<Item, unknown>[] = [
    { accessorKey: "name", header: "Nama" },
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
                const result = await deleteAction(row.original.id)
                if (result?.error) {
                  setDeleteError(result.error)
                  toast.error(result.error)
                } else {
                  toast.success("Data berhasil dihapus.")
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
        <h2 className="text-lg font-semibold">{title}</h2>
        <Button onClick={() => openDialog("new")}>{addLabel}</Button>
      </div>

      {deleteError ? (
        <p className="mb-2 text-destructive text-sm">{deleteError}</p>
      ) : null}

      <DataTable
        columns={columns}
        data={items}
        searchPlaceholder="Cari..."
        emptyMessage="Belum ada data."
      />

      <Dialog
        open={dialogItem !== null}
        onOpenChange={(open) => !open && setDialogItem(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogItem === "new" ? addLabel : "Edit"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Nama</Label>
              <Input
                id="name"
                name="name"
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
