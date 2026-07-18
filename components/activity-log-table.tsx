"use client"

import type { ColumnDef } from "@tanstack/react-table"

import { Badge } from "@/components/ui/badge"
import { DataTable } from "@/components/data-table"

type LogRow = {
  id: number
  username: string
  action: string
  entityType: string
  description: string
  ipAddress: string | null
  userAgent: string | null
  createdAt: Date
}

const ACTION_LABEL: Record<string, string> = {
  LOGIN: "Login",
  LOGIN_FAILED: "Login Gagal",
  LOGOUT: "Logout",
  CREATE: "Tambah",
  UPDATE: "Ubah",
  DELETE: "Hapus",
  RESTORE: "Pulihkan",
  GRANT_HR_ADMIN: "Beri Akses HR",
  REVOKE_HR_ADMIN: "Cabut Akses HR",
}

const ACTION_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  LOGIN: "default",
  LOGIN_FAILED: "destructive",
  LOGOUT: "outline",
  CREATE: "default",
  UPDATE: "secondary",
  DELETE: "destructive",
  RESTORE: "default",
  GRANT_HR_ADMIN: "default",
  REVOKE_HR_ADMIN: "destructive",
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

function parseDevice(userAgent: string | null) {
  if (!userAgent) return "-"

  const os = /Windows/.test(userAgent)
    ? "Windows"
    : /Mac OS X/.test(userAgent)
      ? "macOS"
      : /Android/.test(userAgent)
        ? "Android"
        : /iPhone|iPad/.test(userAgent)
          ? "iOS"
          : /Linux/.test(userAgent)
            ? "Linux"
            : "OS Lain"

  const browser = /Edg\//.test(userAgent)
    ? "Edge"
    : /Chrome\//.test(userAgent)
      ? "Chrome"
      : /Firefox\//.test(userAgent)
        ? "Firefox"
        : /Safari\//.test(userAgent)
          ? "Safari"
          : "Browser Lain"

  return `${browser} · ${os}`
}

export function ActivityLogTable({ logs }: { logs: LogRow[] }) {
  const columns: ColumnDef<LogRow, unknown>[] = [
    {
      id: "createdAt",
      header: "Waktu",
      accessorFn: (row) => formatDateTime(row.createdAt),
    },
    { accessorKey: "username", header: "Pengguna" },
    {
      id: "action",
      header: "Aksi",
      accessorFn: (row) => ACTION_LABEL[row.action] ?? row.action,
      cell: ({ row }) => (
        <Badge variant={ACTION_VARIANT[row.original.action] ?? "secondary"}>
          {ACTION_LABEL[row.original.action] ?? row.original.action}
        </Badge>
      ),
    },
    { accessorKey: "entityType", header: "Entitas" },
    {
      accessorKey: "description",
      header: "Deskripsi",
      cell: ({ row }) => (
        <span className="block max-w-md whitespace-normal">
          {row.original.description}
        </span>
      ),
    },
    {
      id: "device",
      header: "Perangkat",
      accessorFn: (row) => parseDevice(row.userAgent),
      cell: ({ row }) => (
        <span
          className="whitespace-nowrap text-muted-foreground"
          title={row.original.userAgent ?? undefined}
        >
          {parseDevice(row.original.userAgent)}
        </span>
      ),
    },
    {
      id: "ipAddress",
      header: "IP",
      accessorFn: (row) => row.ipAddress ?? "-",
      cell: ({ row }) => (
        <span className="whitespace-nowrap text-muted-foreground">
          {row.original.ipAddress ?? "-"}
        </span>
      ),
    },
  ]

  return (
    <DataTable
      columns={columns}
      data={logs}
      searchPlaceholder="Cari pengguna, aksi, deskripsi..."
      emptyMessage="Belum ada aktivitas tercatat."
      pageSize={20}
    />
  )
}
