"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import type { ColumnDef } from "@tanstack/react-table"
import { Paperclip } from "lucide-react"
import { toast } from "sonner"

import { updateIssueReportAction } from "@/server/actions/issue-reports"
import {
  ISSUE_CATEGORY_LABEL,
  ISSUE_STATUSES,
  ISSUE_STATUS_LABEL,
  type IssueCategory,
  type IssueStatus,
} from "@/lib/issue-report-labels"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { DataTable } from "@/components/data-table"
import { IssueReportImages } from "@/components/issue-report-images"
import { IssueStatusBadge, TicketNumber } from "@/components/issue-status-badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export type IssueReportRow = {
  publicId: string
  ticketNumber: string
  employeeName: string
  employeeNumber: string
  category: IssueCategory
  title: string
  description: string
  attachmentUrls: string[]
  status: IssueStatus
  adminNote: string | null
  handledBy: string | null
  createdAt: string // ISO
}

const FILTER_OPEN = "OPEN"
const FILTER_ALL = "ALL"
type Filter = typeof FILTER_OPEN | typeof FILTER_ALL | IssueStatus

const STATUS_ITEMS = ISSUE_STATUSES.map((s) => ({ value: s, label: ISSUE_STATUS_LABEL[s] }))

function matchesFilter(row: IssueReportRow, filter: Filter) {
  if (filter === FILTER_ALL) return true
  if (filter === FILTER_OPEN) return row.status === "BARU" || row.status === "DIPROSES"
  return row.status === filter
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
}

function DetailItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="mt-0.5 break-words text-sm font-medium">{children}</div>
    </div>
  )
}

function ReviewDialog({
  report,
  onClose,
}: {
  report: IssueReportRow
  onClose: () => void
}) {
  const router = useRouter()
  const [status, setStatus] = useState<IssueStatus>(report.status)
  const [note, setNote] = useState(report.adminNote ?? "")
  const [isPending, startTransition] = useTransition()

  function handleSave() {
    startTransition(async () => {
      const result = await updateIssueReportAction(report.publicId, {
        status,
        adminNote: note,
      })
      if (result?.error) {
        toast.error(result.error)
        return
      }
      toast.success(`Tiket ${report.ticketNumber} diperbarui.`)
      router.refresh()
      onClose()
    })
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-2">
            <TicketNumber value={report.ticketNumber} />
            <IssueStatusBadge status={report.status} />
          </div>
          <DialogTitle className="break-words text-left leading-snug">{report.title}</DialogTitle>
          <DialogDescription className="sr-only">
            Detail dan tindak lanjut laporan kendala {report.ticketNumber}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg border p-3 sm:grid-cols-4">
          <DetailItem label="Pelapor">
            {report.employeeName}
            <span className="block text-xs font-normal text-muted-foreground">{report.employeeNumber}</span>
          </DetailItem>
          <DetailItem label="Kategori">{ISSUE_CATEGORY_LABEL[report.category]}</DetailItem>
          <DetailItem label="Masuk">
            {formatDate(report.createdAt)}
            <span className="block text-xs font-normal text-muted-foreground">{formatTime(report.createdAt)}</span>
          </DetailItem>
          <DetailItem label="Ditangani oleh">{report.handledBy ?? "—"}</DetailItem>
        </div>

        <div className="grid gap-1.5">
          <p className="text-xs font-medium text-muted-foreground">Deskripsi</p>
          <p className="max-h-48 overflow-y-auto whitespace-pre-wrap break-words rounded-lg bg-muted/60 p-3 text-sm">
            {report.description}
          </p>
        </div>

        {report.attachmentUrls.length > 0 ? (
          <div className="grid gap-1.5">
            <p className="text-xs font-medium text-muted-foreground">
              Lampiran ({report.attachmentUrls.length})
            </p>
            <IssueReportImages urls={report.attachmentUrls} />
          </div>
        ) : null}

        <div className="grid gap-4 border-t pt-4">
          <p className="text-sm font-semibold">Tindak Lanjut</p>
          <div className="grid gap-2 sm:max-w-xs">
            <Label>Status</Label>
            <Select
              value={status}
              onValueChange={(value) => setStatus((value ?? report.status) as IssueStatus)}
              items={STATUS_ITEMS}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_ITEMS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="adminNote">
              Tanggapan untuk pelapor{" "}
              <span className="font-normal text-muted-foreground">
                {status === "DITOLAK" ? "(wajib)" : "(opsional)"}
              </span>
            </Label>
            <Textarea
              id="adminNote"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder={
                status === "DITOLAK"
                  ? "Jelaskan alasan penolakan"
                  : "Mis. sudah diperbaiki, silakan coba lagi"
              }
            />
            <p className="text-xs text-muted-foreground">
              Tanggapan ini terlihat oleh pelapor di halaman Laporkan Kendala.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Batal
          </Button>
          <Button onClick={handleSave} disabled={isPending}>
            {isPending ? "Menyimpan..." : "Simpan Perubahan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function IssueReportTable({ reports }: { reports: IssueReportRow[] }) {
  const [filter, setFilter] = useState<Filter>(FILTER_OPEN)
  const [selected, setSelected] = useState<IssueReportRow | null>(null)

  const filters: { value: Filter; label: string }[] = [
    { value: FILTER_OPEN, label: "Belum Selesai" },
    ...STATUS_ITEMS,
    { value: FILTER_ALL, label: "Semua" },
  ]
  const data = reports.filter((r) => matchesFilter(r, filter))

  const columns: ColumnDef<IssueReportRow, unknown>[] = [
    {
      accessorKey: "ticketNumber",
      header: "No. Tiket",
      cell: ({ row }) => <TicketNumber value={row.original.ticketNumber} />,
    },
    {
      id: "report",
      header: "Laporan",
      accessorFn: (row) => `${row.title} ${ISSUE_CATEGORY_LABEL[row.category]}`,
      cell: ({ row }) => (
        <div className="max-w-md min-w-48">
          <p className="truncate font-medium" title={row.original.title}>
            {row.original.title}
          </p>
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            {ISSUE_CATEGORY_LABEL[row.original.category]}
            {row.original.attachmentUrls.length > 0 ? (
              <span className="inline-flex items-center gap-0.5">
                <Paperclip className="size-3" />
                {row.original.attachmentUrls.length}
              </span>
            ) : null}
          </p>
        </div>
      ),
    },
    {
      id: "employee",
      header: "Pelapor",
      accessorFn: (row) => `${row.employeeName} ${row.employeeNumber}`,
      cell: ({ row }) => (
        <div>
          <p className="font-medium">{row.original.employeeName}</p>
          <p className="text-xs text-muted-foreground">{row.original.employeeNumber}</p>
        </div>
      ),
    },
    {
      id: "createdAt",
      header: "Masuk",
      accessorFn: (row) => formatDate(row.createdAt),
      cell: ({ row }) => (
        <div className="whitespace-nowrap">
          <p>{formatDate(row.original.createdAt)}</p>
          <p className="text-xs text-muted-foreground">{formatTime(row.original.createdAt)}</p>
        </div>
      ),
    },
    {
      id: "status",
      header: "Status",
      accessorFn: (row) => ISSUE_STATUS_LABEL[row.status],
      cell: ({ row }) => <IssueStatusBadge status={row.original.status} />,
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Aksi</span>,
      meta: { className: "text-right" },
      cell: ({ row }) => (
        <Button variant="outline" size="sm" onClick={() => setSelected(row.original)}>
          Tinjau
        </Button>
      ),
    },
  ]

  return (
    <>
      <div className="mb-3 flex flex-wrap gap-1.5" role="tablist" aria-label="Filter status">
        {filters.map((item) => {
          const count = reports.filter((r) => matchesFilter(r, item.value)).length
          const active = filter === item.value
          return (
            <button
              key={item.value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setFilter(item.value)}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-sm transition",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {item.label}
              <span
                className={cn(
                  "rounded-full px-1.5 text-xs tabular-nums",
                  active ? "bg-primary-foreground/20" : "bg-muted"
                )}
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>

      <DataTable
        columns={columns}
        data={data}
        searchPlaceholder="Cari no. tiket, pelapor, judul..."
        emptyMessage="Tidak ada laporan pada filter ini."
      />
      {selected ? (
        <ReviewDialog key={selected.publicId} report={selected} onClose={() => setSelected(null)} />
      ) : null}
    </>
  )
}
