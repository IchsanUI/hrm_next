"use client"

import { useMemo, useState, useTransition, type ReactNode } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { Printer, ShieldCheck } from "lucide-react"
import { toast } from "sonner"

import type { IzinMonitoringRow } from "@/lib/izin-monitoring-constants"
import { confirmArrivalAsAdminAction } from "@/server/actions/late-arrival"
import { izinStatusLabel, izinStatusVariant } from "@/components/riwayat-izin-content"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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

function formatRequestedAt(date: Date) {
  return date.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })
}

// Cuma pengajuan yang statusnya sudah "Disetujui" DAN tidak lagi nunggu
// langkah kedua (Lembur: Tahap 2, Terlambat: konfirmasi kedatangan) yang
// boleh dicetak — tampil "Menunggu Tahap 2"/"Menunggu Konfirmasi" (lihat
// izinStatusLabel), diperlakukan sama seperti Menunggu Approval: belum
// final, jadi tidak bisa dicentang.
function isPrintable(row: IzinMonitoringRow) {
  if (row.status !== "APPROVED" && row.status !== "COMPLETED") return false
  return !row.pendingSecondaryStep
}

export function IzinMonitoringTable({
  rows,
  filters,
  isSuperAdmin = false,
}: {
  rows: IzinMonitoringRow[]
  filters: ReactNode
  isSuperAdmin?: boolean
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirmingRow, setConfirmingRow] = useState<IzinMonitoringRow | null>(null)
  const [arrivalTime, setArrivalTime] = useState("")
  const [isConfirming, startConfirmTransition] = useTransition()
  const printableRows = useMemo(() => rows.filter(isPrintable), [rows])

  const allSelected =
    printableRows.length > 0 && printableRows.every((r) => selected.has(r.publicId))

  function toggleAll(checked: boolean) {
    setSelected(checked ? new Set(printableRows.map((r) => r.publicId)) : new Set())
  }

  function toggleOne(publicId: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (checked) next.add(publicId)
      else next.delete(publicId)
      return next
    })
  }

  function handleBulkPrint() {
    const items = rows
      .filter((r) => selected.has(r.publicId))
      .map((r) => `${r.kind}:${r.publicId}`)
      .join(",")
    // Langsung unduh file PDF (generate di server) — bukan buka tab preview
    // buat di-print manual lewat browser.
    window.location.href = `/api/laporan/izin-print?items=${encodeURIComponent(items)}`
  }

  function handleConfirmArrival() {
    if (!confirmingRow) return
    if (!arrivalTime) {
      toast.error("Isi jam kedatangan (dari mesin absen) terlebih dahulu.")
      return
    }
    const target = confirmingRow
    startConfirmTransition(async () => {
      const result = await confirmArrivalAsAdminAction(target.id, arrivalTime)
      if (result?.error) {
        toast.error(result.error)
      } else {
        toast.success(`Kedatangan "${target.employeeName}" berhasil dikonfirmasi.`)
      }
      setConfirmingRow(null)
      setArrivalTime("")
    })
  }

  const columns: ColumnDef<IzinMonitoringRow, unknown>[] = useMemo(
    () => [
      {
        id: "select",
        // Sticky kiri — tabel ini punya banyak kolom & sering di-scroll
        // horizontal, tanpa ini checkbox-nya ikut ke-scroll dan cuma
        // kelihatan seuprit (kepotong) di tepi kiri layar. Lebar tetap
        // (w-12) + dibungkus flex-center supaya kotaknya proporsional,
        // bukan cuma sepipih border kolom.
        meta: { className: "sticky left-0 z-10 w-12 bg-background" },
        header: () => (
          <div className="flex items-center justify-center">
            <Checkbox
              aria-label="Pilih semua"
              checked={allSelected}
              onCheckedChange={(checked) => toggleAll(checked === true)}
              disabled={printableRows.length === 0}
              className="size-5"
            />
          </div>
        ),
        cell: ({ row }) => {
          const printable = isPrintable(row.original)
          return (
            <div
              className="flex items-center justify-center"
              title={printable ? undefined : "Cuma pengajuan yang sudah Disetujui yang bisa dicetak"}
            >
              <Checkbox
                aria-label="Pilih baris"
                checked={selected.has(row.original.publicId)}
                onCheckedChange={(checked) => toggleOne(row.original.publicId, checked === true)}
                disabled={!printable}
                className="size-5"
              />
            </div>
          )
        },
      },
      { accessorKey: "type", header: "Jenis Izin" },
      {
        id: "employee",
        header: "Pegawai",
        cell: ({ row }) => (
          <div className="text-sm">
            <div>{row.original.employeeName}</div>
            <div className="text-xs text-muted-foreground">
              {row.original.employeeNumber} · {row.original.departmentName}
            </div>
          </div>
        ),
      },
      { accessorKey: "date", header: "Tanggal Izin" },
      {
        id: "requestedAt",
        header: "Diajukan",
        accessorFn: (row) => formatRequestedAt(row.requestedAt),
      },
      {
        accessorKey: "summary",
        header: "Keterangan",
        cell: ({ row }) => (
          <p className="max-w-[240px] truncate" title={row.original.summary}>
            {row.original.summary}
          </p>
        ),
      },
      {
        id: "status",
        header: "Status",
        accessorFn: (row) => izinStatusLabel(row.kind, row.status, row.pendingSecondaryStep),
        cell: ({ row }) => (
          <Badge
            variant={izinStatusVariant(
              row.original.kind,
              row.original.status,
              row.original.pendingSecondaryStep
            )}
          >
            {izinStatusLabel(row.original.kind, row.original.status, row.original.pendingSecondaryStep)}
          </Badge>
        ),
      },
      {
        id: "actions",
        header: "Aksi",
        cell: ({ row }) => {
          const canManualConfirm =
            isSuperAdmin && row.original.kind === "terlambat" && row.original.pendingSecondaryStep
          if (!canManualConfirm) {
            return <span className="text-sm text-muted-foreground">-</span>
          }
          return (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setArrivalTime("")
                setConfirmingRow(row.original)
              }}
            >
              <ShieldCheck className="size-3.5" />
              Konfirmasi
            </Button>
          )
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selected, allSelected, rows, printableRows, isSuperAdmin]
  )

  return (
    <div className="grid gap-3">
      {selected.size > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-primary/20 bg-primary/5 p-2.5 text-sm">
          <span className="font-medium">{selected.size} Document Dipilih</span>
          <span className="text-xs text-muted-foreground">
            {selected.size === 1
              ? "akan diunduh langsung sebagai satu file PDF."
              : "akan digabung otomatis ke dalam satu file ZIP berisi PDF per pengajuan."}
          </span>
          <div className="ml-auto flex gap-2">
            <Button size="sm" onClick={handleBulkPrint}>
              <Printer className="size-3.5" />
              Unduh PDF
            </Button>
            <Button size="sm" variant="outline" onClick={() => setSelected(new Set())}>
              Batalkan Pilihan
            </Button>
          </div>
        </div>
      ) : null}

      <DataTable
        columns={columns}
        data={rows}
        searchPlaceholder="Cari nama pegawai, keterangan..."
        emptyMessage="Tidak ada pengajuan izin pada periode ini."
        toolbarEnd={filters}
      />

      <AlertDialog
        open={confirmingRow !== null}
        onOpenChange={(open) => !open && setConfirmingRow(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Konfirmasi kedatangan secara manual?</AlertDialogTitle>
            <AlertDialogDescription>
              Kedatangan &quot;{confirmingRow?.employeeName}&quot; akan ditandai sudah
              dikonfirmasi atas nama Super Admin — dipakai kalau pegawai lupa konfirmasi
              sendiri sebelum batas waktu (11:00). Tindakan ini tercatat di Log Aktivitas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor="arrival-time">Jam Kedatangan</Label>
            <Input
              id="arrival-time"
              type="time"
              value={arrivalTime}
              onChange={(e) => setArrivalTime(e.target.value)}
              disabled={isConfirming}
            />
            <p className="text-xs text-muted-foreground">
              Ambil dari data mesin absen fingerprint, bukan jam saat ini.
            </p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isConfirming}>Batal</AlertDialogCancel>
            <AlertDialogAction disabled={isConfirming} onClick={handleConfirmArrival}>
              {isConfirming ? "Mengonfirmasi..." : "Konfirmasi"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
