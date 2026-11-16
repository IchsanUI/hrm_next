"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import type { ColumnDef } from "@tanstack/react-table"
import { Clock, CheckCircle2, XCircle, Eye, CheckCheck, Loader2 } from "lucide-react"

import { approveOvertimeRequestAction, rejectOvertimeRequestAction } from "@/server/actions/overtime"
import {
  approveOfficeExitRequestAction,
  rejectOfficeExitRequestAction,
} from "@/server/actions/office-exit"
import {
  approveEarlyLeaveRequestAction,
  rejectEarlyLeaveRequestAction,
} from "@/server/actions/early-leave"
import {
  approveLateArrivalRequestAction,
  rejectLateArrivalRequestAction,
} from "@/server/actions/late-arrival"
import {
  approveSickLeaveRequestAction,
  rejectSickLeaveRequestAction,
  reviseSickLeaveRequestAction,
} from "@/server/actions/sick-leave"
import {
  approveCutiRequestAction,
  rejectCutiRequestAction,
  reviseCutiRequestAction,
} from "@/server/actions/cuti"
import {
  approveMaternityLeaveRequestAction,
  rejectMaternityLeaveRequestAction,
  reviseMaternityLeaveRequestAction,
} from "@/server/actions/maternity-leave"
import {
  approveSpecialLeaveRequestAction,
  rejectSpecialLeaveRequestAction,
  reviseSpecialLeaveRequestAction,
} from "@/server/actions/special-leave"
import {
  approveDispensationRequestAction,
  rejectDispensationRequestAction,
  reviseDispensationRequestAction,
} from "@/server/actions/dispensation"
import {
  approveCutiBesarRequestAction,
  rejectCutiBesarRequestAction,
  reviseCutiBesarRequestAction,
} from "@/server/actions/cuti-besar"
import {
  approveUnpaidLeaveRequestAction,
  rejectUnpaidLeaveRequestAction,
  reviseUnpaidLeaveRequestAction,
} from "@/server/actions/unpaid-leave"
import {
  approveOffSiteAttendanceRequestAction,
  rejectOffSiteAttendanceRequestAction,
} from "@/server/actions/off-site-attendance"
import {
  approveAttendanceStatementRequestAction,
  rejectAttendanceStatementRequestAction,
} from "@/server/actions/attendance-statement"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DataTable } from "@/components/data-table"
import { RejectDialog } from "@/components/reject-dialog"
import { ApproveDialog } from "@/components/approve-dialog"
import { Tabs, TabsList, TabsTrigger, TabsPanel } from "@/components/ui/tabs"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { batchApproveAction, type BatchApproveResult } from "@/server/actions/approval-batch"
import type { ApproverType } from "@/lib/approval-step-labels"

// yyyy-mm-dd (waktu lokal) buat default value date-range filter — dicocokkan
// sama ApprovalQueueRow/ApprovalHistoryRow.dateValue yang dihitung di server.
function todayDateValue() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

// Default "Dari" saat halaman pertama dibuka — tanggal 1 bulan berjalan
// (bukan hari ini), biar semua pengajuan bulan ini langsung kelihatan tanpa
// perlu atur ulang rentang tanggal manual.
function firstDayOfMonthValue() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  return `${year}-${month}-01`
}

export type ApprovalQueueRow = {
  id: number
  publicId: string
  kind:
    | "lembur"
    | "meninggalkan_kantor"
    | "pulang_cepat"
    | "terlambat"
    | "sakit"
    | "cuti"
    | "cuti_bersalin"
    | "cuti_khusus"
    | "dispensasi"
    | "cuti_besar"
    | "cuti_diluar_tanggungan"
    | "absen_luar_kantor"
    | "tidak_absen"
    | "payroll"
  applicant: string
  type: string
  date: string
  // yyyy-mm-dd (waktu lokal) dari tanggal pengajuan — dipakai buat filter
  // rentang tanggal, terpisah dari "date" yang formatnya buat ditampilkan.
  dateValue: string
  summary: string
  // Tipe approver step yang lagi aktif — dipakai buat Izin Sakit membedakan
  // step Pegawai Pengganti (tombol Bersedia/Tidak Bersedia) dari step
  // approval biasa (tombol Setujui/Tolak).
  currentStepType: ApproverType
}

export type ApprovalHistoryRow = {
  id: number
  publicId: string
  kind: ApprovalQueueRow["kind"]
  applicant: string
  type: string
  date: string
  dateValue: string
  summary: string
  status: "APPROVED" | "REJECTED"
  actedAt: string
}

export type ApprovalStats = {
  pending: number
  approvedThisMonth: number
  rejectedThisMonth: number
}

const HISTORY_STATUS_LABEL: Record<ApprovalHistoryRow["status"], string> = {
  APPROVED: "Disetujui",
  REJECTED: "Ditolak",
}

const HISTORY_STATUS_VARIANT: Record<
  ApprovalHistoryRow["status"],
  "default" | "destructive"
> = {
  APPROVED: "default",
  REJECTED: "destructive",
}

const KIND_CONFIG = {
  lembur: {
    detailSegment: "",
    approve: approveOvertimeRequestAction,
    reject: rejectOvertimeRequestAction,
    rejectTitle: "Tolak Pengajuan Lembur",
    rejectSuccessMessage: "Pengajuan lembur ditolak.",
  },
  meninggalkan_kantor: {
    detailSegment: "meninggalkan-kantor/",
    approve: approveOfficeExitRequestAction,
    reject: rejectOfficeExitRequestAction,
    rejectTitle: "Tolak Izin Meninggalkan Kantor",
    rejectSuccessMessage: "Izin meninggalkan kantor ditolak.",
  },
  pulang_cepat: {
    detailSegment: "pulang-cepat/",
    approve: approveEarlyLeaveRequestAction,
    reject: rejectEarlyLeaveRequestAction,
    rejectTitle: "Tolak Izin Pulang Cepat",
    rejectSuccessMessage: "Izin pulang cepat ditolak.",
  },
  terlambat: {
    detailSegment: "terlambat/",
    approve: approveLateArrivalRequestAction,
    reject: rejectLateArrivalRequestAction,
    rejectTitle: "Tolak Izin Terlambat",
    rejectSuccessMessage: "Izin terlambat ditolak.",
  },
  sakit: {
    detailSegment: "sakit/",
    approve: approveSickLeaveRequestAction,
    reject: rejectSickLeaveRequestAction,
    rejectTitle: "Tolak Izin Sakit",
    rejectSuccessMessage: "Izin sakit ditolak.",
    revise: reviseSickLeaveRequestAction,
    reviseTitle: "Tidak Bersedia sebagai Pengganti",
    reviseSuccessMessage: "Anda menyatakan tidak bersedia sebagai pengganti.",
  },
  cuti: {
    detailSegment: "cuti/",
    approve: approveCutiRequestAction,
    reject: rejectCutiRequestAction,
    rejectTitle: "Tolak Izin Cuti",
    rejectSuccessMessage: "Izin cuti ditolak.",
    revise: reviseCutiRequestAction,
    reviseTitle: "Tidak Bersedia sebagai Pengganti",
    reviseSuccessMessage: "Anda menyatakan tidak bersedia sebagai pengganti.",
  },
  cuti_bersalin: {
    detailSegment: "cuti-bersalin/",
    approve: approveMaternityLeaveRequestAction,
    reject: rejectMaternityLeaveRequestAction,
    rejectTitle: "Tolak Cuti Bersalin/Gugur Kandungan",
    rejectSuccessMessage: "Pengajuan ditolak.",
    revise: reviseMaternityLeaveRequestAction,
    reviseTitle: "Tidak Bersedia sebagai Pengganti",
    reviseSuccessMessage: "Anda menyatakan tidak bersedia sebagai pengganti.",
  },
  cuti_khusus: {
    detailSegment: "cuti-khusus/",
    approve: approveSpecialLeaveRequestAction,
    reject: rejectSpecialLeaveRequestAction,
    rejectTitle: "Tolak Cuti Khusus Haji/Umroh",
    rejectSuccessMessage: "Pengajuan ditolak.",
    revise: reviseSpecialLeaveRequestAction,
    reviseTitle: "Tidak Bersedia sebagai Pengganti",
    reviseSuccessMessage: "Anda menyatakan tidak bersedia sebagai pengganti.",
  },
  dispensasi: {
    detailSegment: "dispensasi/",
    approve: approveDispensationRequestAction,
    reject: rejectDispensationRequestAction,
    rejectTitle: "Tolak Dispensasi",
    rejectSuccessMessage: "Pengajuan ditolak.",
    revise: reviseDispensationRequestAction,
    reviseTitle: "Tidak Bersedia sebagai Pengganti",
    reviseSuccessMessage: "Anda menyatakan tidak bersedia sebagai pengganti.",
  },
  cuti_besar: {
    detailSegment: "cuti-besar/",
    approve: approveCutiBesarRequestAction,
    reject: rejectCutiBesarRequestAction,
    rejectTitle: "Tolak Cuti Besar",
    rejectSuccessMessage: "Pengajuan ditolak.",
    revise: reviseCutiBesarRequestAction,
    reviseTitle: "Tidak Bersedia sebagai Pengganti",
    reviseSuccessMessage: "Anda menyatakan tidak bersedia sebagai pengganti.",
  },
  cuti_diluar_tanggungan: {
    detailSegment: "cuti-diluar-tanggungan/",
    approve: approveUnpaidLeaveRequestAction,
    reject: rejectUnpaidLeaveRequestAction,
    rejectTitle: "Tolak Cuti Di Luar Tanggungan",
    rejectSuccessMessage: "Pengajuan ditolak.",
    revise: reviseUnpaidLeaveRequestAction,
    reviseTitle: "Tidak Bersedia sebagai Pengganti",
    reviseSuccessMessage: "Anda menyatakan tidak bersedia sebagai pengganti.",
  },
  absen_luar_kantor: {
    detailSegment: "absen-luar-kantor/",
    approve: approveOffSiteAttendanceRequestAction,
    reject: rejectOffSiteAttendanceRequestAction,
    rejectTitle: "Tolak Izin Absen Diluar Kantor",
    rejectSuccessMessage: "Izin absen diluar kantor ditolak.",
  },
  tidak_absen: {
    detailSegment: "tidak-absen/",
    approve: approveAttendanceStatementRequestAction,
    reject: rejectAttendanceStatementRequestAction,
    rejectTitle: "Tolak Pernyataan Tidak Absen",
    rejectSuccessMessage: "Pernyataan tidak absen ditolak.",
  },
} as const

function detailHref(
  basePath: "/admin" | "/pegawai",
  row: { kind: ApprovalQueueRow["kind"]; publicId: string }
) {
  // Payroll bukan "izin" — halaman tinjauannya berdiri sendiri dan SELALU di
  // bawah /pegawai/** (penyetujunya bisa pegawai biasa yang tidak punya akses
  // /admin/**, lihat proxy.ts).
  if (row.kind === "payroll") return `/pegawai/persetujuan-payroll/${row.publicId}`
  return `${basePath}/riwayat-izin/${KIND_CONFIG[row.kind].detailSegment}${row.publicId}`
}

const SUBSTITUTE_KINDS: ApprovalQueueRow["kind"][] = [
  "sakit",
  "cuti",
  "cuti_bersalin",
  "cuti_khusus",
  "dispensasi",
  "cuti_besar",
  "cuti_diluar_tanggungan",
]

function isSubstituteStepRow(row: ApprovalQueueRow) {
  return SUBSTITUTE_KINDS.includes(row.kind) && row.currentStepType === "PEGAWAI_PENGGANTI"
}

// Yang boleh ikut approval batch: bukan Payroll (wajib ditinjau angkanya)
// dan bukan step Pegawai Pengganti (pernyataan kesediaan pribadi).
function batchIneligibleReason(row: ApprovalQueueRow): string | null {
  if (row.kind === "payroll") return "Payroll wajib ditinjau di halamannya sendiri"
  if (isSubstituteStepRow(row)) return "Konfirmasi pengganti harus satu per satu"
  return null
}

function rowKey(row: { kind: string; id: number }) {
  return `${row.kind}:${row.id}`
}

function BatchApproveDialog({
  open,
  onOpenChange,
  rows,
  onDone,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  rows: ApprovalQueueRow[]
  onDone: (result: BatchApproveResult) => void
}) {
  const [confirmText, setConfirmText] = useState("")
  const [catatan, setCatatan] = useState("")
  const [failed, setFailed] = useState<NonNullable<BatchApproveResult["failed"]>>([])
  const [isPending, startTransition] = useTransition()

  function close(next: boolean) {
    if (isPending) return
    if (!next) {
      setConfirmText("")
      setCatatan("")
      setFailed([])
    }
    onOpenChange(next)
  }

  function submit() {
    startTransition(async () => {
      const result = await batchApproveAction(
        rows.map((r) => ({ kind: r.kind, id: r.id })),
        confirmText,
        catatan
      )
      if (result.error) {
        toast.error(result.error)
        return
      }
      onDone(result)
      if (result.failed && result.failed.length > 0) {
        setFailed(result.failed)
        setConfirmText("")
      } else {
        close(false)
      }
    })
  }

  if (failed.length > 0) {
    return (
      <Dialog open={open} onOpenChange={close}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sebagian pengajuan gagal disetujui</DialogTitle>
            <DialogDescription>
              {failed.length} pengajuan tidak dapat diproses. Pengajuan lainnya sudah disetujui.
            </DialogDescription>
          </DialogHeader>
          <ul className="max-h-64 divide-y overflow-y-auto rounded-lg border text-sm">
            {failed.map((f) => (
              <li key={`${f.kind}:${f.id}`} className="px-3 py-2">
                <p className="font-medium">
                  {f.applicant} · <span className="font-normal text-muted-foreground">{f.type}</span>
                </p>
                <p className="text-xs text-destructive">{f.reason}</p>
              </li>
            ))}
          </ul>
          <DialogFooter>
            <Button onClick={() => close(false)}>Tutup</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Setujui {rows.length} pengajuan sekaligus?</DialogTitle>
          <DialogDescription>
            Setiap pengajuan di bawah akan disetujui pada langkah approval Anda dan diteruskan ke
            langkah berikutnya (jika ada). Pemohon menerima notifikasi seperti biasa.
          </DialogDescription>
        </DialogHeader>

        <ul className="max-h-56 divide-y overflow-y-auto rounded-lg border text-sm">
          {rows.map((r) => (
            <li key={rowKey(r)} className="px-3 py-2">
              <p className="truncate font-medium">{r.applicant}</p>
              <p className="truncate text-xs text-muted-foreground">
                {r.type} · {r.date}
                {r.summary ? ` · ${r.summary}` : ""}
              </p>
            </li>
          ))}
        </ul>

        <div className="grid gap-2">
          <Label htmlFor="batch-catatan">
            Catatan <span className="font-normal text-muted-foreground">(opsional, berlaku untuk semua)</span>
          </Label>
          <Textarea
            id="batch-catatan"
            value={catatan}
            onChange={(e) => setCatatan(e.target.value)}
            rows={2}
            maxLength={500}
            disabled={isPending}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="batch-confirm">
            Ketik <span className="font-mono font-semibold">SETUJU</span> untuk melanjutkan
          </Label>
          <Input
            id="batch-confirm"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            autoComplete="off"
            disabled={isPending}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)} disabled={isPending}>
            Batal
          </Button>
          <Button onClick={submit} disabled={isPending || confirmText.trim() !== "SETUJU"}>
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <CheckCheck className="size-4" />}
            {isPending ? `Memproses ${rows.length} pengajuan...` : `Setujui ${rows.length} Pengajuan`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ApprovalActions({
  row,
  basePath,
}: {
  row: ApprovalQueueRow
  basePath: "/admin" | "/pegawai"
}) {
  // Payroll SENGAJA tidak punya tombol Setujui/Tolak inline di tabel:
  // keputusannya menyangkut nominal gaji seluruh pegawai, jadi penyetuju
  // harus membuka halaman tinjauan dan melihat angkanya dulu (di sana ada
  // ringkasan, rincian per pegawai, dan konfirmasi sebelum menyetujui).
  if (row.kind === "payroll") {
    return (
      <Button
        variant="outline"
        size="sm"
        render={<Link href={detailHref(basePath, row)} />}
        nativeButton={false}
      >
        <Eye className="size-3.5" />
        Tinjau &amp; Putuskan
      </Button>
    )
  }

  const config = KIND_CONFIG[row.kind]

  // Step Pegawai Pengganti (Izin Sakit, Izin Cuti, Cuti Bersalin, Cuti
  // Khusus) bukan approval biasa — pengganti cuma menyatakan bersedia/tidak,
  // jadi tombolnya beda dari Setujui/Tolak.
  const isSubstituteStep = isSubstituteStepRow(row)

  return (
    <div className="flex gap-2">
      <Button
        variant="outline"
        size="sm"
        render={<Link href={detailHref(basePath, row)} />}
        nativeButton={false}
      >
        <Eye className="size-3.5" />
        Detail
      </Button>
      <ApproveDialog
        requestId={row.id}
        applicant={row.applicant}
        approveAction={config.approve}
        actionLabel={isSubstituteStep ? "Bersedia" : "Setujui"}
        title={isSubstituteStep ? "Konfirmasi Kesediaan sebagai Pengganti" : `Setujui ${row.type}`}
        successMessage={
          isSubstituteStep
            ? "Anda menyatakan bersedia sebagai pengganti."
            : `Pengajuan ${row.applicant} disetujui.`
        }
      />
      {isSubstituteStep &&
      (row.kind === "sakit" ||
        row.kind === "cuti" ||
        row.kind === "cuti_bersalin" ||
        row.kind === "cuti_khusus" ||
        row.kind === "dispensasi" ||
        row.kind === "cuti_besar" ||
        row.kind === "cuti_diluar_tanggungan") ? (
        <RejectDialog
          requestId={row.id}
          applicant={row.applicant}
          title={KIND_CONFIG[row.kind].reviseTitle}
          successMessage={KIND_CONFIG[row.kind].reviseSuccessMessage}
          rejectAction={KIND_CONFIG[row.kind].revise}
        />
      ) : (
        <RejectDialog
          requestId={row.id}
          applicant={row.applicant}
          title={config.rejectTitle}
          successMessage={config.rejectSuccessMessage}
          rejectAction={config.reject}
        />
      )}
    </div>
  )
}

export function ApprovalCenterContent({
  queue,
  history,
  stats,
  basePath,
}: {
  queue: ApprovalQueueRow[]
  history: ApprovalHistoryRow[]
  stats: ApprovalStats
  basePath: "/admin" | "/pegawai"
}) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [batchOpen, setBatchOpen] = useState(false)
  const [startDate, setStartDate] = useState(firstDayOfMonthValue)
  const [endDate, setEndDate] = useState(todayDateValue)

  // Antrean "Menunggu Approval" SENGAJA tidak disaring tanggal — pengajuan
  // yang belum diproses harus selalu tampil (walau diajukan di luar rentang
  // Dari/Sampai) supaya tidak ada yang terlewat. Filter tanggal cuma berlaku
  // untuk tab Riwayat.
  const filteredHistory = history.filter(
    (r) => (!startDate || r.dateValue >= startDate) && (!endDate || r.dateValue <= endDate)
  )

  const eligibleRows = queue.filter((r) => batchIneligibleReason(r) === null)
  // Pilihan yang masih valid saja (baris yang sudah hilang dari antrean setelah refresh dibuang).
  const selectedRows = eligibleRows.filter((r) => selected.has(rowKey(r)))
  const allSelected = eligibleRows.length > 0 && selectedRows.length === eligibleRows.length

  function toggleAll(checked: boolean) {
    setSelected(checked ? new Set(eligibleRows.map(rowKey)) : new Set())
  }

  function toggleOne(row: ApprovalQueueRow, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (checked) next.add(rowKey(row))
      else next.delete(rowKey(row))
      return next
    })
  }

  function handleBatchDone(result: BatchApproveResult) {
    if ((result.approved ?? 0) > 0) toast.success(`${result.approved} pengajuan disetujui.`)
    setSelected(new Set())
    router.refresh()
  }

  const columns: ColumnDef<ApprovalQueueRow, unknown>[] = [
    {
      id: "select",
      meta: { className: "w-12" },
      header: () => (
        <div className="flex items-center justify-center">
          <Checkbox
            aria-label="Pilih semua pengajuan"
            checked={allSelected}
            onCheckedChange={(checked) => toggleAll(checked === true)}
            disabled={eligibleRows.length === 0}
            className="size-5"
          />
        </div>
      ),
      cell: ({ row }) => {
        const reason = batchIneligibleReason(row.original)
        return (
          <div className="flex items-center justify-center" title={reason ?? undefined}>
            <Checkbox
              aria-label={`Pilih pengajuan ${row.original.applicant}`}
              checked={selected.has(rowKey(row.original))}
              onCheckedChange={(checked) => toggleOne(row.original, checked === true)}
              disabled={reason !== null}
              className="size-5"
            />
          </div>
        )
      },
    },
    { accessorKey: "applicant", header: "Pemohon" },
    { accessorKey: "type", header: "Jenis Izin" },
    { accessorKey: "date", header: "Tanggal Pengajuan" },
    {
      accessorKey: "summary",
      header: "Keterangan",
      cell: ({ row }) => (
        <p className="max-w-[280px] truncate" title={row.original.summary}>
          {row.original.summary}
        </p>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: () => <Badge variant="secondary">Menunggu Approval</Badge>,
    },
    {
      id: "actions",
      header: "Aksi",
      cell: ({ row }) => <ApprovalActions row={row.original} basePath={basePath} />,
    },
  ]

  const historyColumns: ColumnDef<ApprovalHistoryRow, unknown>[] = [
    { accessorKey: "applicant", header: "Pemohon" },
    { accessorKey: "type", header: "Jenis Izin" },
    { accessorKey: "date", header: "Tanggal Pengajuan" },
    {
      accessorKey: "summary",
      header: "Keterangan",
      cell: ({ row }) => (
        <p className="max-w-[280px] truncate" title={row.original.summary}>
          {row.original.summary}
        </p>
      ),
    },
    {
      id: "status",
      header: "Status",
      accessorFn: (row) => HISTORY_STATUS_LABEL[row.status],
      cell: ({ row }) => (
        <Badge variant={HISTORY_STATUS_VARIANT[row.original.status]}>
          {HISTORY_STATUS_LABEL[row.original.status]}
        </Badge>
      ),
    },
    { accessorKey: "actedAt", header: "Diproses Pada" },
    {
      id: "actions",
      header: "Aksi",
      cell: ({ row }) => (
        <Button
          variant="outline"
          size="sm"
          render={<Link href={detailHref(basePath, row.original)} />}
          nativeButton={false}
        >
          <Eye className="size-3.5" />
          Detail
        </Button>
      ),
    },
  ]

  const statCards = [
    { label: "Menunggu Approval", value: stats.pending, icon: Clock },
    { label: "Disetujui Bulan Ini", value: stats.approvedThisMonth, icon: CheckCircle2 },
    { label: "Ditolak Bulan Ini", value: stats.rejectedThisMonth, icon: XCircle },
  ]

  const dateRangeFilter = (
    <div className="flex flex-wrap items-center gap-2">
      <Label className="shrink-0">Tanggal</Label>
      <span className="text-sm text-muted-foreground">Dari</span>
      <Input
        aria-label="Dari tanggal"
        type="date"
        value={startDate}
        max={endDate || undefined}
        onChange={(e) => setStartDate(e.target.value)}
        className="w-fit"
      />
      <span className="text-sm text-muted-foreground">Sampai</span>
      <Input
        aria-label="Sampai tanggal"
        type="date"
        value={endDate}
        min={startDate || undefined}
        onChange={(e) => setEndDate(e.target.value)}
        className="w-fit"
      />
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          setStartDate(todayDateValue())
          setEndDate(todayDateValue())
        }}
      >
        Hari Ini
      </Button>
    </div>
  )

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold">Approval Center</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Pantau dan proses pengajuan izin dari tim Anda yang masuk ke antrian
        approval.
      </p>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        {statCards.map((stat) => {
          const Icon = stat.icon
          return (
            <Card key={stat.label}>
              <CardContent className="flex items-center gap-3 py-5">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Icon className="size-5" />
                </span>
                <div>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                  <p className="text-xl font-bold">{stat.value}</p>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Tabs defaultValue="antrian">
        <TabsList>
          <TabsTrigger value="antrian">Menunggu Approval</TabsTrigger>
          <TabsTrigger value="riwayat">Riwayat Approval</TabsTrigger>
        </TabsList>

        <TabsPanel value="antrian">
          {selectedRows.length > 0 ? (
            <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md border border-primary/20 bg-primary/5 p-2.5 text-sm">
              <span className="font-medium">{selectedRows.length} pengajuan dipilih</span>
              {eligibleRows.length < queue.length ? (
                <span className="text-xs text-muted-foreground">
                  Payroll &amp; konfirmasi pengganti tetap diproses satu per satu.
                </span>
              ) : null}
              <div className="ml-auto flex gap-2">
                <Button size="sm" onClick={() => setBatchOpen(true)}>
                  <CheckCheck className="size-3.5" />
                  Setujui Terpilih
                </Button>
                <Button size="sm" variant="outline" onClick={() => setSelected(new Set())}>
                  Batalkan Pilihan
                </Button>
              </div>
            </div>
          ) : null}
          <BatchApproveDialog
            open={batchOpen}
            onOpenChange={setBatchOpen}
            rows={selectedRows}
            onDone={handleBatchDone}
          />
          <DataTable
            columns={columns}
            data={queue}
            searchPlaceholder="Cari pemohon, jenis izin..."
            emptyMessage="Tidak ada pengajuan yang menunggu approval Anda."
          />
        </TabsPanel>

        <TabsPanel value="riwayat">
          <DataTable
            columns={historyColumns}
            data={filteredHistory}
            searchPlaceholder="Cari pemohon, jenis izin..."
            emptyMessage="Belum ada riwayat approval pada rentang tanggal ini."
            toolbarEnd={dateRangeFilter}
          />
        </TabsPanel>
      </Tabs>
    </div>
  )
}
