"use client"

import { useState, useTransition } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { toast } from "sonner"

import { setHrAdminAccessAction, updateHrAdminMenuAccessAction } from "@/server/actions/access"
import { HR_MENU_GROUPS, type HrMenuKey } from "@/lib/hr-menu-access"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { DataTable } from "@/components/data-table"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"

type AccessRow = {
  id: number
  fullName: string
  employeeNumber: string
  position: string
  department: string
  role: "SUPER_ADMIN" | "HR_ADMIN" | "EMPLOYEE"
  menuAccess: HrMenuKey[]
}

const ROLE_LABEL: Record<AccessRow["role"], string> = {
  SUPER_ADMIN: "Super Admin",
  HR_ADMIN: "HR Admin",
  EMPLOYEE: "Pegawai",
}

function MenuAccessDialog({
  row,
  mode,
  onOpenChange,
}: {
  row: AccessRow | null
  mode: "grant" | "manage"
  onOpenChange: (open: boolean) => void
}) {
  const [selected, setSelected] = useState<HrMenuKey[]>([])
  const [isPending, startTransition] = useTransition()

  // Reset pilihan checkbox tiap kali dialog dibuka buat baris berbeda —
  // pola "adjust state during render", bukan useEffect (lihat React docs
  // "You Might Not Need An Effect").
  const rowId = row?.id
  const [lastRowId, setLastRowId] = useState<number | undefined>(undefined)
  if (row && rowId !== lastRowId) {
    setLastRowId(rowId)
    setSelected(row.menuAccess)
  }

  function toggle(key: HrMenuKey, checked: boolean) {
    setSelected((prev) => (checked ? [...prev, key] : prev.filter((k) => k !== key)))
  }

  function handleSave() {
    if (!row) return
    startTransition(async () => {
      const result =
        mode === "grant"
          ? await setHrAdminAccessAction(row.id, true, selected)
          : await updateHrAdminMenuAccessAction(row.id, selected)
      if (result?.error) {
        toast.error(result.error)
      } else {
        toast.success(
          mode === "grant"
            ? `${row.fullName} sekarang jadi HR Admin.`
            : `Akses menu ${row.fullName} berhasil diperbarui.`
        )
        onOpenChange(false)
      }
    })
  }

  return (
    <Dialog open={row !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === "grant" ? "Jadikan HR Admin" : "Kelola Akses Menu"}
          </DialogTitle>
          <DialogDescription>
            Pilih sub-menu admin yang boleh diakses {row?.fullName ?? "pegawai ini"}
            — bisa sebagian isi grup saja, tidak harus semuanya. Menu yang
            tidak dicentang akan disembunyikan dari sidebar dan diblokir
            kalau diakses langsung lewat URL.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 max-h-[60vh] overflow-y-auto pr-1">
          {HR_MENU_GROUPS.map((group) => {
            // Grup "Laporan" cuma punya satu sub-menu yang key-nya sama
            // dengan key grupnya sendiri — tampilkan datar, tidak perlu
            // checkbox "pilih semua" yang jadi duplikat.
            if (group.items.length === 1 && group.items[0].key === group.key) {
              const item = group.items[0]
              return (
                <div key={group.key} className="flex items-center gap-2">
                  <Checkbox
                    id={`menu-${item.key}`}
                    checked={selected.includes(item.key)}
                    onCheckedChange={(checked) => toggle(item.key, checked === true)}
                  />
                  <Label htmlFor={`menu-${item.key}`} className="text-sm font-normal">
                    {group.label}
                  </Label>
                </div>
              )
            }

            const selectedCount = group.items.filter((i) => selected.includes(i.key)).length
            const allSelected = selectedCount === group.items.length
            const someSelected = selectedCount > 0 && !allSelected

            return (
              <div key={group.key}>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id={`menu-group-${group.key}`}
                    checked={allSelected}
                    indeterminate={someSelected}
                    onCheckedChange={(checked) =>
                      setSelected((prev) => {
                        const withoutGroup = prev.filter(
                          (k) => !group.items.some((i) => i.key === k)
                        )
                        return checked === true
                          ? [...withoutGroup, ...group.items.map((i) => i.key)]
                          : withoutGroup
                      })
                    }
                  />
                  <Label htmlFor={`menu-group-${group.key}`} className="text-sm font-medium">
                    {group.label}
                  </Label>
                </div>
                <div className="mt-1.5 ml-6 grid gap-1.5">
                  {group.items.map((item) => (
                    <div key={item.key} className="flex items-center gap-2">
                      <Checkbox
                        id={`menu-${item.key}`}
                        checked={selected.includes(item.key)}
                        onCheckedChange={(checked) => toggle(item.key, checked === true)}
                      />
                      <Label htmlFor={`menu-${item.key}`} className="text-sm font-normal text-muted-foreground">
                        {item.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button disabled={isPending} onClick={handleSave}>
            {isPending ? "Menyimpan..." : "Simpan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function AccessHrTable({ users }: { users: AccessRow[] }) {
  const [isPending, startTransition] = useTransition()
  const [dialogRow, setDialogRow] = useState<AccessRow | null>(null)
  const [dialogMode, setDialogMode] = useState<"grant" | "manage">("grant")

  function openDialog(row: AccessRow, mode: "grant" | "manage") {
    setDialogMode(mode)
    setDialogRow(row)
  }

  function handleRevoke(row: AccessRow) {
    startTransition(async () => {
      const result = await setHrAdminAccessAction(row.id, false)
      if (result?.error) {
        toast.error(result.error)
      } else {
        toast.success(`Akses HR Admin ${row.fullName} dicabut.`)
      }
    })
  }

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
      id: "menuAccess",
      header: "Akses Menu",
      cell: ({ row }) => {
        if (row.original.role !== "HR_ADMIN") {
          return <span className="text-sm text-muted-foreground">-</span>
        }
        if (row.original.menuAccess.length === 0) {
          return <span className="text-xs text-amber-600">Belum ada menu dibuka</span>
        }
        const summary = HR_MENU_GROUPS.map((g) => {
          const count = g.items.filter((i) => row.original.menuAccess.includes(i.key)).length
          if (count === 0) return null
          if (count === g.items.length) return g.label
          return `${g.label} (${count}/${g.items.length})`
        }).filter((s): s is string => s !== null)
        return <span className="text-xs text-muted-foreground">{summary.join(", ")}</span>
      },
    },
    {
      id: "actions",
      header: "Aksi",
      cell: ({ row }) => {
        if (row.original.role === "SUPER_ADMIN") {
          return <span className="text-sm text-muted-foreground">-</span>
        }
        const isHrAdmin = row.original.role === "HR_ADMIN"
        if (isHrAdmin) {
          return (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={isPending}
                onClick={() => openDialog(row.original, "manage")}
              >
                Kelola Akses Menu
              </Button>
              <Button
                size="sm"
                variant="destructive"
                disabled={isPending}
                onClick={() => handleRevoke(row.original)}
              >
                Cabut Akses HR Admin
              </Button>
            </div>
          )
        }
        return (
          <Button
            size="sm"
            disabled={isPending}
            onClick={() => openDialog(row.original, "grant")}
          >
            Jadikan HR Admin
          </Button>
        )
      },
    },
  ]

  return (
    <>
      <DataTable
        columns={columns}
        data={users}
        searchPlaceholder="Cari nama, NIP, bagian..."
        emptyMessage="Belum ada akun pegawai."
      />
      <MenuAccessDialog
        row={dialogRow}
        mode={dialogMode}
        onOpenChange={(open) => !open && setDialogRow(null)}
      />
    </>
  )
}
