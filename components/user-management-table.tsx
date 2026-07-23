"use client"

import { useState, useTransition, type FormEvent } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { Shuffle } from "lucide-react"
import { toast } from "sonner"

import {
  createSystemAccountAction,
  adminResetPasswordAction,
  toggleUserActiveAction,
  updateSystemAccountRoleAction,
  unlockUserAction,
} from "@/server/actions/user-management"
import { SYSTEM_ACCOUNT_ROLES } from "@/lib/validations/user-management"
import { formatRelativeTime } from "@/lib/relative-time"
import { generateClientPassword } from "@/lib/generate-password"
import { PasswordChecklist } from "@/components/password-checklist"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { PasswordInput } from "@/components/ui/password-input"
import { Label } from "@/components/ui/label"
import { DataTable } from "@/components/data-table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"

type UserRow = {
  id: number
  username: string
  isActive: boolean
  role: "SUPER_ADMIN" | "HR_ADMIN" | "EMPLOYEE"
  employeeId: number | null
  employeeFullName: string | null
  employeeNumber: string | null
  lastLoginAt: Date | null
  failedLoginCount: number
  isLocked: boolean
}

const ROLE_LABEL: Record<UserRow["role"], string> = {
  SUPER_ADMIN: "Super Admin",
  HR_ADMIN: "HR Admin",
  EMPLOYEE: "Pegawai",
}

const SYSTEM_ROLE_LABEL: Record<(typeof SYSTEM_ACCOUNT_ROLES)[number], string> = {
  SUPER_ADMIN: "Super Admin",
  HR_ADMIN: "HR Admin",
}

function CreateAccountDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  function handleGenerate() {
    const generated = generateClientPassword()
    setPassword(generated)
    setConfirmPassword(generated)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    startTransition(async () => {
      const result = await createSystemAccountAction(undefined, formData)
      if (result?.error) {
        setError(result.error)
        toast.error(result.error)
      } else {
        setError(null)
        setPassword("")
        setConfirmPassword("")
        onOpenChange(false)
        toast.success("Akun sistem berhasil dibuat.")
      }
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setError(null)
          setPassword("")
          setConfirmPassword("")
        }
        onOpenChange(next)
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Buat Akun Sistem</DialogTitle>
          <DialogDescription>
            Akun login tanpa data pegawai — untuk kebutuhan seperti akun
            cadangan Super Admin, vendor/IT support, atau konsultan.
          </DialogDescription>
        </DialogHeader>
        <form key={open ? "open" : "closed"} onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="username">Username</Label>
            <Input id="username" name="username" required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password">Password</Label>
            <div className="flex gap-2">
              <PasswordInput
                id="password"
                name="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleGenerate}
                title="Generate password acak"
              >
                <Shuffle className="size-4" />
              </Button>
            </div>
            <PasswordChecklist value={password} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="confirmPassword">Konfirmasi Password</Label>
            <PasswordInput
              id="confirmPassword"
              name="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label>Role</Label>
            <Select name="role" defaultValue="HR_ADMIN" items={SYSTEM_ACCOUNT_ROLES.map((r) => ({ value: r, label: SYSTEM_ROLE_LABEL[r] }))}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Pilih role" />
              </SelectTrigger>
              <SelectContent>
                {SYSTEM_ACCOUNT_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {SYSTEM_ROLE_LABEL[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {error ? <p className="text-destructive text-sm">{error}</p> : null}
          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Menyimpan..." : "Buat Akun"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ResetPasswordDialog({
  row,
  onOpenChange,
}: {
  row: UserRow | null
  onOpenChange: (open: boolean) => void
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  function handleGenerate() {
    const generated = generateClientPassword()
    setPassword(generated)
    setConfirmPassword(generated)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!row) return
    const formData = new FormData(event.currentTarget)
    startTransition(async () => {
      const result = await adminResetPasswordAction(row.id, undefined, formData)
      if (result?.error) {
        setError(result.error)
        toast.error(result.error)
      } else {
        setError(null)
        setPassword("")
        setConfirmPassword("")
        onOpenChange(false)
        toast.success(`Password akun "${row.username}" berhasil direset.`)
      }
    })
  }

  return (
    <Dialog
      open={row !== null}
      onOpenChange={(next) => {
        if (!next) {
          setError(null)
          setPassword("")
          setConfirmPassword("")
        }
        onOpenChange(next)
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset Password</DialogTitle>
          <DialogDescription>
            Atur password baru untuk akun &quot;{row?.username}&quot;. Pengguna perlu
            login ulang dengan password baru ini.
          </DialogDescription>
        </DialogHeader>
        <form key={row?.id ?? "none"} onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="newPassword">Password Baru</Label>
            <div className="flex gap-2">
              <PasswordInput
                id="newPassword"
                name="newPassword"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleGenerate}
                title="Generate password acak"
              >
                <Shuffle className="size-4" />
              </Button>
            </div>
            <PasswordChecklist value={password} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="confirmPassword">Konfirmasi Password Baru</Label>
            <PasswordInput
              id="confirmPassword"
              name="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>
          {error ? <p className="text-destructive text-sm">{error}</p> : null}
          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Menyimpan..." : "Reset Password"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ChangeRoleDialog({
  row,
  onOpenChange,
}: {
  row: UserRow | null
  onOpenChange: (open: boolean) => void
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!row) return
    const formData = new FormData(event.currentTarget)
    startTransition(async () => {
      const result = await updateSystemAccountRoleAction(row.id, undefined, formData)
      if (result?.error) {
        setError(result.error)
        toast.error(result.error)
      } else {
        setError(null)
        onOpenChange(false)
        toast.success(`Role akun "${row.username}" berhasil diubah.`)
      }
    })
  }

  return (
    <Dialog
      open={row !== null}
      onOpenChange={(next) => {
        if (!next) setError(null)
        onOpenChange(next)
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ubah Role</DialogTitle>
          <DialogDescription>
            Ubah role akun &quot;{row?.username}&quot;.
          </DialogDescription>
        </DialogHeader>
        <form key={row?.id ?? "none"} onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label>Role</Label>
            <Select
              name="role"
              defaultValue={row?.role ?? "HR_ADMIN"}
              items={SYSTEM_ACCOUNT_ROLES.map((r) => ({ value: r, label: SYSTEM_ROLE_LABEL[r] }))}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Pilih role" />
              </SelectTrigger>
              <SelectContent>
                {SYSTEM_ACCOUNT_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {SYSTEM_ROLE_LABEL[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {error ? <p className="text-destructive text-sm">{error}</p> : null}
          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Menyimpan..." : "Simpan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function formatDateTime(date: Date) {
  return date.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function UserManagementTable({
  users,
  currentUserId,
}: {
  users: UserRow[]
  currentUserId: number
}) {
  const [isPending, startTransition] = useTransition()
  const [createOpen, setCreateOpen] = useState(false)
  const [resetPasswordRow, setResetPasswordRow] = useState<UserRow | null>(null)
  const [changeRoleRow, setChangeRoleRow] = useState<UserRow | null>(null)

  function handleToggleActive(row: UserRow) {
    startTransition(async () => {
      const result = await toggleUserActiveAction(row.id, !row.isActive)
      if (result?.error) {
        toast.error(result.error)
      } else {
        toast.success(
          row.isActive
            ? `Akun "${row.username}" dinonaktifkan.`
            : `Akun "${row.username}" diaktifkan.`
        )
      }
    })
  }

  function handleUnlock(row: UserRow) {
    startTransition(async () => {
      const result = await unlockUserAction(row.id)
      if (result?.error) {
        toast.error(result.error)
      } else {
        toast.success(`Akun "${row.username}" dibuka kuncinya.`)
      }
    })
  }

  const columns: ColumnDef<UserRow, unknown>[] = [
    { accessorKey: "username", header: "Username" },
    {
      id: "employeeFullName",
      header: "Nama Pegawai",
      accessorFn: (row) => row.employeeFullName ?? "",
      cell: ({ row }) =>
        row.original.employeeId ? (
          row.original.employeeFullName
        ) : (
          <Badge variant="outline">Akun Sistem</Badge>
        ),
    },
    {
      id: "employeeNumber",
      header: "NIP",
      accessorFn: (row) => row.employeeNumber ?? "-",
    },
    {
      id: "role",
      header: "Role",
      accessorFn: (row) => ROLE_LABEL[row.role],
      cell: ({ row }) => (
        <Badge variant={row.original.role === "EMPLOYEE" ? "secondary" : "default"}>
          {ROLE_LABEL[row.original.role]}
        </Badge>
      ),
    },
    {
      id: "isActive",
      header: "Status",
      accessorFn: (row) => (row.isActive ? "Aktif" : "Nonaktif"),
      cell: ({ row }) => (
        <Badge variant={row.original.isActive ? "default" : "destructive"}>
          {row.original.isActive ? "Aktif" : "Nonaktif"}
        </Badge>
      ),
    },
    {
      id: "isLocked",
      header: "Kunci",
      accessorFn: (row) => (row.isLocked ? "Terkunci" : "-"),
      cell: ({ row }) =>
        row.original.isLocked ? (
          <Badge
            variant="outline"
            className="border-red-200 bg-red-50 text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400"
          >
            Terkunci (5x gagal login)
          </Badge>
        ) : (
          <span className="text-sm text-muted-foreground">-</span>
        ),
    },
    {
      id: "lastLoginAt",
      header: "Login Terakhir",
      accessorFn: (row) => (row.lastLoginAt ? formatDateTime(row.lastLoginAt) : "-"),
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {row.original.lastLoginAt
            ? formatRelativeTime(row.original.lastLoginAt)
            : "Belum pernah login"}
        </span>
      ),
    },
    {
      id: "failedLoginCount",
      header: "Gagal Login (7 hari)",
      accessorFn: (row) => row.failedLoginCount,
      cell: ({ row }) => (
        <span
          className={
            row.original.failedLoginCount > 0
              ? "font-medium text-amber-600"
              : "text-muted-foreground"
          }
        >
          {row.original.failedLoginCount}
        </span>
      ),
    },
    {
      id: "actions",
      header: "Aksi",
      cell: ({ row }) => {
        const isSelf = row.original.id === currentUserId
        if (isSelf) {
          return <span className="text-sm text-muted-foreground">-</span>
        }
        return (
          <div className="flex flex-wrap gap-2">
            {row.original.isLocked ? (
              <Button
                size="sm"
                variant="default"
                disabled={isPending}
                onClick={() => handleUnlock(row.original)}
              >
                Buka Kunci
              </Button>
            ) : null}
            <Button
              size="sm"
              variant="outline"
              disabled={isPending}
              onClick={() => setResetPasswordRow(row.original)}
            >
              Reset Password
            </Button>
            {row.original.employeeId === null ? (
              <Button
                size="sm"
                variant="outline"
                disabled={isPending}
                onClick={() => setChangeRoleRow(row.original)}
              >
                Ubah Role
              </Button>
            ) : null}
            <Button
              size="sm"
              variant={row.original.isActive ? "destructive" : "default"}
              disabled={isPending}
              onClick={() => handleToggleActive(row.original)}
            >
              {row.original.isActive ? "Nonaktifkan" : "Aktifkan"}
            </Button>
          </div>
        )
      },
    },
  ]

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Daftar Akun</h2>
          <p className="text-sm text-muted-foreground">
            Semua akun login, termasuk akun sistem tanpa data pegawai.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>Buat Akun Sistem</Button>
      </div>

      <DataTable
        columns={columns}
        data={users}
        searchPlaceholder="Cari username, nama pegawai, atau NIP..."
        emptyMessage="Belum ada akun."
      />

      <CreateAccountDialog open={createOpen} onOpenChange={setCreateOpen} />
      <ResetPasswordDialog row={resetPasswordRow} onOpenChange={(open) => !open && setResetPasswordRow(null)} />
      <ChangeRoleDialog row={changeRoleRow} onOpenChange={(open) => !open && setChangeRoleRow(null)} />
    </div>
  )
}
