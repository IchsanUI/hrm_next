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
            Pilih grup menu admin yang boleh diakses {row?.fullName ?? "pegawai ini"}.
            Menu yang tidak dicentang akan disembunyikan dari sidebar dan
            diblokir kalau diakses langsung lewat URL.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2.5">
          {HR_MENU_GROUPS.map((group) => (
            <div key={group.key} className="flex items-center gap-2">
              <Checkbox
                id={`menu-${group.key}`}
                checked={selected.includes(group.key)}
                onCheckedChange={(checked) => toggle(group.key, checked === true)}
              />
              <Label htmlFor={`menu-${group.key}`} className="text-sm font-normal">
                {group.label}
              </Label>
            </div>
          ))}
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
        return (
          <span className="text-xs text-muted-foreground">
            {HR_MENU_GROUPS.filter((g) => row.original.menuAccess.includes(g.key))
              .map((g) => g.label)
              .join(", ")}
          </span>
        )
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
