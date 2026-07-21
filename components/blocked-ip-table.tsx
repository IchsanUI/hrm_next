"use client"

import { useTransition } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { toast } from "sonner"

import { unblockIpAction } from "@/server/actions/login-ip-blocks"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { DataTable } from "@/components/data-table"

export type BlockedIpRow = {
  id: number
  ip: string
  unknownAttemptCount: number
  blockedUntil: Date | null
  permanentlyBlocked: boolean
  lastUsername: string | null
  updatedAt: Date
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

export function BlockedIpTable({ rows }: { rows: BlockedIpRow[] }) {
  const [isPending, startTransition] = useTransition()

  function handleUnblock(row: BlockedIpRow) {
    startTransition(async () => {
      const result = await unblockIpAction(row.id)
      if (result?.error) {
        toast.error(result.error)
      } else {
        toast.success(`Blokir untuk IP ${row.ip} dibuka.`)
      }
    })
  }

  const columns: ColumnDef<BlockedIpRow, unknown>[] = [
    { accessorKey: "ip", header: "Alamat IP" },
    {
      id: "status",
      header: "Status",
      accessorFn: (row) => (row.permanentlyBlocked ? "Permanen" : "Cooldown"),
      cell: ({ row }) =>
        row.original.permanentlyBlocked ? (
          <Badge variant="destructive">Diblokir Permanen</Badge>
        ) : (
          <Badge
            variant="outline"
            className="border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-400"
          >
            Cooldown sampai{" "}
            {row.original.blockedUntil ? formatDateTime(row.original.blockedUntil) : "-"}
          </Badge>
        ),
    },
    { accessorKey: "unknownAttemptCount", header: "Jumlah Percobaan" },
    {
      id: "lastUsername",
      header: "Username Terakhir Dicoba",
      accessorFn: (row) => row.lastUsername ?? "-",
    },
    {
      id: "updatedAt",
      header: "Percobaan Terakhir",
      accessorFn: (row) => formatDateTime(row.updatedAt),
    },
    {
      id: "actions",
      header: "Aksi",
      cell: ({ row }) => (
        <Button
          size="sm"
          variant="outline"
          disabled={isPending}
          onClick={() => handleUnblock(row.original)}
        >
          Buka Blokir
        </Button>
      ),
    },
  ]

  return (
    <DataTable
      columns={columns}
      data={rows}
      searchPlaceholder="Cari alamat IP..."
      emptyMessage="Tidak ada IP yang sedang diblokir."
    />
  )
}
