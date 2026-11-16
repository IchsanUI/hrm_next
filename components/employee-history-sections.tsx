"use client"

import { useActionState } from "react"
import Link from "next/link"
import type { ColumnDef } from "@tanstack/react-table"

import { useFormActionToast } from "@/lib/use-form-toast"
import {
  addWorkHistoryAction,
  deleteWorkHistoryAction,
  updateWorkHistoryAction,
  addTrainingAction,
  deleteTrainingAction,
  updateTrainingAction,
  addAchievementAction,
  deleteAchievementAction,
  updateAchievementAction,
  addRewardPunishmentAction,
  deleteRewardPunishmentAction,
  updateRewardPunishmentAction,
  addMutationAction,
  deleteMutationAction,
  updateMutationAction,
  addAssignmentLetterAction,
  deleteAssignmentLetterAction,
  updateAssignmentLetterAction,
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
import { HistoryRowActions, type HistoryField } from "@/components/employee-history-row-actions"

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

// yyyy-mm-dd untuk input tanggal di form edit (kolom @db.Date disimpan UTC tengah malam).
function isoDate(date: Date) {
  return new Date(date).toISOString().slice(0, 10)
}

const WORK_FIELDS: HistoryField[] = [
  { name: "date", label: "Tanggal", kind: "date", required: true },
  { name: "description", label: "Uraian", kind: "text", required: true, span: 2 },
]

const DESC_FIELDS: HistoryField[] = WORK_FIELDS

const RP_FIELDS: HistoryField[] = [
  { name: "date", label: "Tanggal", kind: "date", required: true },
  {
    name: "type",
    label: "Jenis Data",
    kind: "select",
    required: true,
    options: [
      { value: "REWARD", label: "Reward" },
      { value: "PUNISHMENT", label: "Punishment" },
    ],
  },
  { name: "description", label: "Uraian", kind: "text", required: true },
]

const MUTATION_FIELDS: HistoryField[] = [
  { name: "date", label: "Tanggal", kind: "date", required: true },
  { name: "oldPosition", label: "Jabatan Lama", kind: "text" },
  { name: "newPosition", label: "Jabatan Baru", kind: "text" },
  { name: "description", label: "Uraian", kind: "text", span: 3 },
]

// --- Riwayat Pekerjaan ---

type WorkHistory = { id: number; date: Date; description: string }

export function EmployeeWorkHistorySection({
  employeeId,
  items,
}: {
  employeeId: number
  items: WorkHistory[]
}) {
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
        <HistoryRowActions
          entityLabel="riwayat pekerjaan"
          summary={`${formatDate(row.original.date)} — ${row.original.description}`}
          fields={WORK_FIELDS}
          initialValues={{ date: isoDate(row.original.date), description: row.original.description }}
          onUpdate={(fd) => updateWorkHistoryAction(row.original.id, employeeId, fd)}
          onDelete={() => deleteWorkHistoryAction(row.original.id, employeeId)}
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
        <HistoryRowActions
          entityLabel="riwayat pelatihan"
          summary={`${formatDate(row.original.date)} — ${row.original.description}`}
          fields={DESC_FIELDS}
          initialValues={{ date: isoDate(row.original.date), description: row.original.description }}
          fileUrl={row.original.fileUrl}
          onUpdate={(fd) => updateTrainingAction(row.original.id, employeeId, fd)}
          onDelete={() => deleteTrainingAction(row.original.id, employeeId)}
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
        <HistoryRowActions
          entityLabel="data prestasi"
          summary={`${formatDate(row.original.date)} — ${row.original.description}`}
          fields={DESC_FIELDS}
          initialValues={{ date: isoDate(row.original.date), description: row.original.description }}
          fileUrl={row.original.fileUrl}
          onUpdate={(fd) => updateAchievementAction(row.original.id, employeeId, fd)}
          onDelete={() => deleteAchievementAction(row.original.id, employeeId)}
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
        <HistoryRowActions
          entityLabel="data reward/punishment"
          summary={`${formatDate(row.original.date)} — ${row.original.type === "PUNISHMENT" ? "Punishment" : "Reward"}: ${row.original.description}`}
          fields={RP_FIELDS}
          initialValues={{ date: isoDate(row.original.date), type: row.original.type, description: row.original.description }}
          onUpdate={(fd) => updateRewardPunishmentAction(row.original.id, employeeId, fd)}
          onDelete={() => deleteRewardPunishmentAction(row.original.id, employeeId)}
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
        <HistoryRowActions
          entityLabel="data mutasi"
          summary={`${formatDate(row.original.date)} — ${row.original.oldPosition || "-"} → ${row.original.newPosition || "-"}${row.original.description ? ` (${row.original.description})` : ""}`}
          fields={MUTATION_FIELDS}
          initialValues={{ date: isoDate(row.original.date), oldPosition: row.original.oldPosition ?? "", newPosition: row.original.newPosition ?? "", description: row.original.description ?? "" }}
          fileUrl={row.original.fileUrl}
          onUpdate={(fd) => updateMutationAction(row.original.id, employeeId, fd)}
          onDelete={() => deleteMutationAction(row.original.id, employeeId)}
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
        <HistoryRowActions
          entityLabel="surat tugas"
          summary={`${formatDate(row.original.date)} — ${row.original.description}`}
          fields={DESC_FIELDS}
          initialValues={{ date: isoDate(row.original.date), description: row.original.description }}
          fileUrl={row.original.fileUrl}
          onUpdate={(fd) => updateAssignmentLetterAction(row.original.id, employeeId, fd)}
          onDelete={() => deleteAssignmentLetterAction(row.original.id, employeeId)}
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
