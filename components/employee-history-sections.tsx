"use client"

import { useActionState, useTransition } from "react"
import Link from "next/link"
import type { ColumnDef } from "@tanstack/react-table"
import { toast } from "sonner"

import { useFormActionToast } from "@/lib/use-form-toast"
import {
  addWorkHistoryAction,
  deleteWorkHistoryAction,
  addTrainingAction,
  deleteTrainingAction,
  addAchievementAction,
  deleteAchievementAction,
  addRewardPunishmentAction,
  deleteRewardPunishmentAction,
  addMutationAction,
  deleteMutationAction,
  addAssignmentLetterAction,
  deleteAssignmentLetterAction,
  type HistoryFormState,
} from "@/server/actions/employee-history"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DataTable } from "@/components/data-table"

function formatDate(date: Date) {
  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

function FileCell({ fileUrl }: { fileUrl: string | null }) {
  return fileUrl ? (
    <Link href={fileUrl} target="_blank" className="text-primary underline-offset-4 hover:underline">
      Unduh File
    </Link>
  ) : (
    <span className="text-muted-foreground">[ File Kosong ]</span>
  )
}

function DeleteButton({
  isPending,
  onDelete,
}: {
  isPending: boolean
  onDelete: () => void
}) {
  return (
    <Button variant="destructive" size="sm" disabled={isPending} onClick={onDelete}>
      Hapus
    </Button>
  )
}

// --- Riwayat Pekerjaan ---

type WorkHistory = { id: number; date: Date; description: string }

export function EmployeeWorkHistorySection({
  employeeId,
  items,
}: {
  employeeId: number
  items: WorkHistory[]
}) {
  const [isPending, startTransition] = useTransition()
  const [state, formAction, isSubmitting] = useActionState<HistoryFormState, FormData>(
    addWorkHistoryAction.bind(null, employeeId),
    undefined
  )
  useFormActionToast(isSubmitting, state?.error, "Riwayat pekerjaan berhasil ditambahkan.")

  const columns: ColumnDef<WorkHistory, unknown>[] = [
    {
      id: "no",
      header: () => <div className="text-center">No</div>,
      cell: ({ row }) => <div className="text-center">{row.index + 1}</div>,
    },
    {
      accessorKey: "date",
      header: "Tanggal",
      cell: ({ row }) => formatDate(row.original.date),
    },
    { accessorKey: "description", header: "Uraian" },
    {
      id: "actions",
      header: "Aksi",
      cell: ({ row }) => (
        <DeleteButton
          isPending={isPending}
          onDelete={() =>
            startTransition(async () => {
              try {
                await deleteWorkHistoryAction(row.original.id, employeeId)
                toast.success("Riwayat pekerjaan berhasil dihapus.")
              } catch {
                toast.error("Gagal menghapus riwayat pekerjaan.")
              }
            })
          }
        />
      ),
    },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Data Riwayat Pekerjaan</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <DataTable columns={columns} data={items} searchPlaceholder="Cari uraian..." emptyMessage="Belum ada riwayat pekerjaan." />

        <form action={formAction} className="grid gap-4 border-t pt-4 sm:grid-cols-3">
          <div className="grid gap-2">
            <Label htmlFor="workhistory-date">Tanggal</Label>
            <Input id="workhistory-date" name="date" type="date" required />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="workhistory-description">Uraian</Label>
            <Input id="workhistory-description" name="description" required />
          </div>
          {state?.error ? (
            <p className="text-destructive text-sm sm:col-span-3">{state.error}</p>
          ) : null}
          <div className="sm:col-span-3">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Menambah..." : "Tambah Riwayat"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

// --- Riwayat Pendidikan dan Pelatihan ---

type Training = { id: number; date: Date; description: string; fileUrl: string | null }

export function EmployeeTrainingSection({
  employeeId,
  items,
}: {
  employeeId: number
  items: Training[]
}) {
  const [isPending, startTransition] = useTransition()
  const [state, formAction, isSubmitting] = useActionState<HistoryFormState, FormData>(
    addTrainingAction.bind(null, employeeId),
    undefined
  )
  useFormActionToast(isSubmitting, state?.error, "Riwayat pelatihan berhasil ditambahkan.")

  const columns: ColumnDef<Training, unknown>[] = [
    {
      id: "no",
      header: () => <div className="text-center">No</div>,
      cell: ({ row }) => <div className="text-center">{row.index + 1}</div>,
    },
    {
      accessorKey: "date",
      header: "Tanggal",
      cell: ({ row }) => formatDate(row.original.date),
    },
    { accessorKey: "description", header: "Uraian" },
    {
      id: "file",
      header: "File Unggahan",
      cell: ({ row }) => <FileCell fileUrl={row.original.fileUrl} />,
    },
    {
      id: "actions",
      header: "Aksi",
      cell: ({ row }) => (
        <DeleteButton
          isPending={isPending}
          onDelete={() =>
            startTransition(async () => {
              try {
                await deleteTrainingAction(row.original.id, employeeId)
                toast.success("Riwayat pelatihan berhasil dihapus.")
              } catch {
                toast.error("Gagal menghapus riwayat pelatihan.")
              }
            })
          }
        />
      ),
    },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Data Riwayat Pendidikan dan Pelatihan</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <DataTable columns={columns} data={items} searchPlaceholder="Cari uraian..." emptyMessage="Belum ada riwayat pelatihan." />

        <form
          action={formAction}
          className="grid gap-4 border-t pt-4 sm:grid-cols-3"
        >
          <div className="grid gap-2">
            <Label htmlFor="training-date">Tanggal</Label>
            <Input id="training-date" name="date" type="date" required />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="training-description">Uraian</Label>
            <Input id="training-description" name="description" required />
          </div>
          <div className="grid gap-2 sm:col-span-3">
            <Label htmlFor="training-file">File Pendukung (opsional)</Label>
            <Input id="training-file" name="file" type="file" />
          </div>
          {state?.error ? (
            <p className="text-destructive text-sm sm:col-span-3">{state.error}</p>
          ) : null}
          <div className="sm:col-span-3">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Menambah..." : "Tambah Pelatihan"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

// --- Data Prestasi ---

type Achievement = { id: number; date: Date; description: string; fileUrl: string | null }

export function EmployeeAchievementSection({
  employeeId,
  items,
}: {
  employeeId: number
  items: Achievement[]
}) {
  const [isPending, startTransition] = useTransition()
  const [state, formAction, isSubmitting] = useActionState<HistoryFormState, FormData>(
    addAchievementAction.bind(null, employeeId),
    undefined
  )
  useFormActionToast(isSubmitting, state?.error, "Data prestasi berhasil ditambahkan.")

  const columns: ColumnDef<Achievement, unknown>[] = [
    {
      id: "no",
      header: () => <div className="text-center">No</div>,
      cell: ({ row }) => <div className="text-center">{row.index + 1}</div>,
    },
    {
      accessorKey: "date",
      header: "Tanggal",
      cell: ({ row }) => formatDate(row.original.date),
    },
    { accessorKey: "description", header: "Uraian" },
    {
      id: "file",
      header: "File Unggahan",
      cell: ({ row }) => <FileCell fileUrl={row.original.fileUrl} />,
    },
    {
      id: "actions",
      header: "Aksi",
      cell: ({ row }) => (
        <DeleteButton
          isPending={isPending}
          onDelete={() =>
            startTransition(async () => {
              try {
                await deleteAchievementAction(row.original.id, employeeId)
                toast.success("Data prestasi berhasil dihapus.")
              } catch {
                toast.error("Gagal menghapus data prestasi.")
              }
            })
          }
        />
      ),
    },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Data Prestasi</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <DataTable columns={columns} data={items} searchPlaceholder="Cari uraian..." emptyMessage="Belum ada data prestasi." />

        <form
          action={formAction}
          className="grid gap-4 border-t pt-4 sm:grid-cols-3"
        >
          <div className="grid gap-2">
            <Label htmlFor="achievement-date">Tanggal</Label>
            <Input id="achievement-date" name="date" type="date" required />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="achievement-description">Uraian</Label>
            <Input id="achievement-description" name="description" required />
          </div>
          <div className="grid gap-2 sm:col-span-3">
            <Label htmlFor="achievement-file">File Pendukung (opsional)</Label>
            <Input id="achievement-file" name="file" type="file" />
          </div>
          {state?.error ? (
            <p className="text-destructive text-sm sm:col-span-3">{state.error}</p>
          ) : null}
          <div className="sm:col-span-3">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Menambah..." : "Tambah Prestasi"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

// --- Data Reward / Punishment ---

type RewardPunishment = {
  id: number
  date: Date
  type: "REWARD" | "PUNISHMENT"
  description: string
}

export function EmployeeRewardPunishmentSection({
  employeeId,
  items,
}: {
  employeeId: number
  items: RewardPunishment[]
}) {
  const [isPending, startTransition] = useTransition()
  const [state, formAction, isSubmitting] = useActionState<HistoryFormState, FormData>(
    addRewardPunishmentAction.bind(null, employeeId),
    undefined
  )
  useFormActionToast(isSubmitting, state?.error, "Data reward/punishment berhasil ditambahkan.")

  const typeItems = [
    { value: "REWARD", label: "Reward" },
    { value: "PUNISHMENT", label: "Punishment" },
  ]

  const columns: ColumnDef<RewardPunishment, unknown>[] = [
    {
      id: "no",
      header: () => <div className="text-center">No</div>,
      cell: ({ row }) => <div className="text-center">{row.index + 1}</div>,
    },
    {
      accessorKey: "date",
      header: "Tanggal",
      cell: ({ row }) => formatDate(row.original.date),
    },
    {
      accessorKey: "type",
      header: "Jenis Data",
      cell: ({ row }) => (
        <Badge variant={row.original.type === "PUNISHMENT" ? "destructive" : "default"}>
          {row.original.type === "PUNISHMENT" ? "Punishment" : "Reward"}
        </Badge>
      ),
    },
    { accessorKey: "description", header: "Uraian" },
    {
      id: "actions",
      header: "Aksi",
      cell: ({ row }) => (
        <DeleteButton
          isPending={isPending}
          onDelete={() =>
            startTransition(async () => {
              try {
                await deleteRewardPunishmentAction(row.original.id, employeeId)
                toast.success("Data reward/punishment berhasil dihapus.")
              } catch {
                toast.error("Gagal menghapus data reward/punishment.")
              }
            })
          }
        />
      ),
    },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Data Reward / Punishment</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <DataTable columns={columns} data={items} searchPlaceholder="Cari uraian..." emptyMessage="Belum ada data reward/punishment." />

        <form action={formAction} className="grid gap-4 border-t pt-4 sm:grid-cols-3">
          <div className="grid gap-2">
            <Label htmlFor="rp-date">Tanggal</Label>
            <Input id="rp-date" name="date" type="date" required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="rp-type">Jenis Data</Label>
            <Select name="type" defaultValue="REWARD" items={typeItems}>
              <SelectTrigger className="w-full" id="rp-type">
                <SelectValue placeholder="Pilih" />
              </SelectTrigger>
              <SelectContent>
                {typeItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="rp-description">Uraian</Label>
            <Input id="rp-description" name="description" required />
          </div>
          {state?.error ? (
            <p className="text-destructive text-sm sm:col-span-3">{state.error}</p>
          ) : null}
          <div className="sm:col-span-3">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Menambah..." : "Tambah Data"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

// --- Data Mutasi Pegawai ---

type EmployeeMutation = {
  id: number
  date: Date
  oldPosition: string | null
  newPosition: string | null
  description: string | null
  fileUrl: string | null
}

export function EmployeeMutationSection({
  employeeId,
  items,
}: {
  employeeId: number
  items: EmployeeMutation[]
}) {
  const [isPending, startTransition] = useTransition()
  const [state, formAction, isSubmitting] = useActionState<HistoryFormState, FormData>(
    addMutationAction.bind(null, employeeId),
    undefined
  )
  useFormActionToast(isSubmitting, state?.error, "Data mutasi berhasil ditambahkan.")

  const columns: ColumnDef<EmployeeMutation, unknown>[] = [
    {
      id: "no",
      header: () => <div className="text-center">No</div>,
      cell: ({ row }) => <div className="text-center">{row.index + 1}</div>,
    },
    {
      accessorKey: "date",
      header: "Tanggal",
      cell: ({ row }) => formatDate(row.original.date),
    },
    {
      id: "positions",
      header: "Jabatan Lama → Jabatan Baru",
      cell: ({ row }) =>
        `${row.original.oldPosition || "-"} → ${row.original.newPosition || "-"}`,
    },
    {
      accessorKey: "description",
      header: "Uraian",
      cell: ({ row }) => row.original.description || "-",
    },
    {
      id: "file",
      header: "File Pendukung",
      cell: ({ row }) => <FileCell fileUrl={row.original.fileUrl} />,
    },
    {
      id: "actions",
      header: "Aksi",
      cell: ({ row }) => (
        <DeleteButton
          isPending={isPending}
          onDelete={() =>
            startTransition(async () => {
              try {
                await deleteMutationAction(row.original.id, employeeId)
                toast.success("Data mutasi berhasil dihapus.")
              } catch {
                toast.error("Gagal menghapus data mutasi.")
              }
            })
          }
        />
      ),
    },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Data Mutasi Pegawai</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <DataTable columns={columns} data={items} searchPlaceholder="Cari uraian..." emptyMessage="Belum ada data mutasi." />

        <form
          action={formAction}
          className="grid gap-4 border-t pt-4 sm:grid-cols-3"
        >
          <div className="grid gap-2">
            <Label htmlFor="mutation-date">Tanggal</Label>
            <Input id="mutation-date" name="date" type="date" required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="mutation-old">Jabatan Lama</Label>
            <Input id="mutation-old" name="oldPosition" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="mutation-new">Jabatan Baru</Label>
            <Input id="mutation-new" name="newPosition" />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="mutation-description">Uraian</Label>
            <Input id="mutation-description" name="description" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="mutation-file">File Pendukung (opsional)</Label>
            <Input id="mutation-file" name="file" type="file" />
          </div>
          {state?.error ? (
            <p className="text-destructive text-sm sm:col-span-3">{state.error}</p>
          ) : null}
          <div className="sm:col-span-3">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Menambah..." : "Tambah Mutasi"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

// --- Data Surat Tugas Pegawai ---

type AssignmentLetter = { id: number; date: Date; description: string; fileUrl: string | null }

export function EmployeeAssignmentLetterSection({
  employeeId,
  items,
}: {
  employeeId: number
  items: AssignmentLetter[]
}) {
  const [isPending, startTransition] = useTransition()
  const [state, formAction, isSubmitting] = useActionState<HistoryFormState, FormData>(
    addAssignmentLetterAction.bind(null, employeeId),
    undefined
  )
  useFormActionToast(isSubmitting, state?.error, "Surat tugas berhasil ditambahkan.")

  const columns: ColumnDef<AssignmentLetter, unknown>[] = [
    {
      id: "no",
      header: () => <div className="text-center">No</div>,
      cell: ({ row }) => <div className="text-center">{row.index + 1}</div>,
    },
    {
      accessorKey: "date",
      header: "Tanggal",
      cell: ({ row }) => formatDate(row.original.date),
    },
    { accessorKey: "description", header: "Uraian" },
    {
      id: "file",
      header: "File Unggahan",
      cell: ({ row }) => <FileCell fileUrl={row.original.fileUrl} />,
    },
    {
      id: "actions",
      header: "Aksi",
      cell: ({ row }) => (
        <DeleteButton
          isPending={isPending}
          onDelete={() =>
            startTransition(async () => {
              try {
                await deleteAssignmentLetterAction(row.original.id, employeeId)
                toast.success("Surat tugas berhasil dihapus.")
              } catch {
                toast.error("Gagal menghapus surat tugas.")
              }
            })
          }
        />
      ),
    },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Data Surat Tugas Pegawai</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <DataTable columns={columns} data={items} searchPlaceholder="Cari uraian..." emptyMessage="Belum ada surat tugas." />

        <form
          action={formAction}
          className="grid gap-4 border-t pt-4 sm:grid-cols-3"
        >
          <div className="grid gap-2">
            <Label htmlFor="letter-date">Tanggal</Label>
            <Input id="letter-date" name="date" type="date" required />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="letter-description">Uraian</Label>
            <Input id="letter-description" name="description" required />
          </div>
          <div className="grid gap-2 sm:col-span-3">
            <Label htmlFor="letter-file">File Pendukung (opsional)</Label>
            <Input id="letter-file" name="file" type="file" />
          </div>
          {state?.error ? (
            <p className="text-destructive text-sm sm:col-span-3">{state.error}</p>
          ) : null}
          <div className="sm:col-span-3">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Menambah..." : "Tambah Surat Tugas"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
