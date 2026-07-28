"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import type { ColumnDef } from "@tanstack/react-table"
import type { Prisma } from "@prisma/client"
import { toast } from "sonner"

import { softDeleteEmployeeAction, toggleEmployeeSelfUpdateAction } from "@/server/actions/employees"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { DataTable } from "@/components/data-table"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

type EmployeeRow = Prisma.EmployeeGetPayload<{
  include: { department: true; position: true; employmentStatus: true }
}>

function toDateInputValue(date: Date | string) {
  return new Date(date).toISOString().slice(0, 10)
}

export function EmployeesTable({ employees }: { employees: EmployeeRow[] }) {
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [deleteReasonType, setDeleteReasonType] = useState<"RESIGN" | "INPUT_ERROR">("RESIGN")
  const [resignDate, setResignDate] = useState("")
  const [reason, setReason] = useState("")
  const [togglingId, setTogglingId] = useState<number | null>(null)
  const [isPending, startTransition] = useTransition()

  const columns: ColumnDef<EmployeeRow, unknown>[] = [
    {
      id: "no",
      header: () => <div className="text-center">No</div>,
      cell: ({ row }) => (
        <div className="text-center">{row.index + 1}</div>
      ),
    },
    {
      id: "photo",
      header: "Foto",
      cell: ({ row }) => (
        <Avatar className="size-9 rounded-md after:rounded-md" size="default">
          {row.original.photoUrl ? (
            <AvatarImage
              src={row.original.photoUrl}
              className="rounded-md object-cover"
            />
          ) : null}
          <AvatarFallback className="rounded-md">
            {row.original.fullName.slice(0, 1)}
          </AvatarFallback>
        </Avatar>
      ),
    },
    { accessorKey: "employeeNumber", header: "NIP" },
    { accessorKey: "fullName", header: "Nama" },
    {
      id: "department",
      header: "Bagian",
      accessorFn: (row) => row.department.name,
    },
    {
      id: "position",
      header: "Jabatan",
      accessorFn: (row) => row.position.name,
    },
    {
      id: "status",
      header: "Status",
      accessorFn: (row) => row.employmentStatus.name,
      cell: ({ row }) => (
        <Badge variant="secondary">{row.original.employmentStatus.name}</Badge>
      ),
    },
    {
      id: "selfUpdate",
      header: "Update Mandiri",
      cell: ({ row }) => {
        const employeeId = row.original.id
        const enabled = row.original.allowSelfUpdate
        return (
          <Button
            variant={enabled ? "default" : "outline"}
            size="sm"
            disabled={togglingId === employeeId}
            onClick={() => {
              setTogglingId(employeeId)
              startTransition(async () => {
                try {
                  await toggleEmployeeSelfUpdateAction(employeeId, !enabled)
                  toast.success(
                    enabled
                      ? "Izin update mandiri dinonaktifkan."
                      : "Izin update mandiri diaktifkan — pegawai bisa update kontak/alamat sendiri sekali."
                  )
                } catch {
                  toast.error("Gagal mengubah izin update mandiri.")
                } finally {
                  setTogglingId(null)
                }
              })
            }}
          >
            {enabled ? "Aktif" : "Aktifkan"}
          </Button>
        )
      },
    },
    {
      id: "actions",
      header: "Aksi",
      cell: ({ row }) => (
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href={`/admin/pegawai/${row.original.publicId}/detail`} />}
          >
            Detail
          </Button>
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href={`/admin/pegawai/${row.original.publicId}`} />}
          >
            Edit
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              setDeletingId(row.original.id)
              setDeleteReasonType("RESIGN")
              // Prefill dari Tanggal Resign/Pensiun yang mungkin sudah diisi
              // lebih dulu lewat form edit pegawai (dicatat sebelum
              // dinonaktifkan, mis. masih masa notice) — tidak perlu ketik
              // ulang di sini kalau memang sudah pernah diisi.
              setResignDate(row.original.resignDate ? toDateInputValue(row.original.resignDate) : "")
              setReason("")
            }}
          >
            Hapus
          </Button>
        </div>
      ),
    },
  ]

  return (
    <>
      <DataTable
        columns={columns}
        data={employees}
        searchPlaceholder="Cari NIP, nama, bagian, jabatan..."
        emptyMessage="Belum ada data pegawai."
        pageSize={10}
      />

      <AlertDialog
        open={deletingId !== null}
        onOpenChange={(open) => !open && setDeletingId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus data pegawai?</AlertDialogTitle>
            <AlertDialogDescription>
              Data akan dipindah ke Data Terhapus dan akun login pegawai
              dinonaktifkan. Anda bisa memulihkannya nanti.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="grid gap-3">
            <div className="grid gap-2">
              <Label>Alasan</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={deleteReasonType === "RESIGN" ? "default" : "outline"}
                  onClick={() => setDeleteReasonType("RESIGN")}
                >
                  Resign
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={deleteReasonType === "INPUT_ERROR" ? "default" : "outline"}
                  onClick={() => setDeleteReasonType("INPUT_ERROR")}
                >
                  Kesalahan Input
                </Button>
              </div>
            </div>

            {deleteReasonType === "RESIGN" ? (
              <div className="grid gap-2">
                <Label htmlFor="resignDate">Tanggal Resign/Pensiun</Label>
                <Input
                  id="resignDate"
                  type="date"
                  value={resignDate}
                  onChange={(e) => setResignDate(e.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Payroll periode yang mengandung tanggal ini tetap otomatis diproses (rekonsiliasi
                  PPh 21 akhir masa kerja) — periode setelahnya tidak lagi menyertakan pegawai ini.
                </p>
              </div>
            ) : null}

            <div className="grid gap-2">
              <Label>Catatan (opsional)</Label>
              <Textarea
                placeholder="Detail tambahan, mis. nomor surat pengunduran diri"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              disabled={isPending || (deleteReasonType === "RESIGN" && !resignDate)}
              onClick={() => {
                if (deletingId === null) return
                const id = deletingId
                const reasonLabel = deleteReasonType === "RESIGN" ? "Resign" : "Kesalahan Input"
                const fullReason = reason ? `${reasonLabel} — ${reason}` : reasonLabel
                const finalResignDate = deleteReasonType === "RESIGN" ? resignDate : null
                startTransition(async () => {
                  try {
                    await softDeleteEmployeeAction(id, fullReason, finalResignDate)
                    toast.success("Pegawai berhasil dihapus.")
                  } catch {
                    toast.error("Gagal menghapus pegawai.")
                  } finally {
                    setDeletingId(null)
                  }
                })
              }}
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
