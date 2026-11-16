"use client"

import { useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  AlertTriangle,
  Archive,
  Download,
  FileUp,
  Loader2,
  RotateCcw,
  ServerOff,
  ShieldCheck,
  Trash2,
} from "lucide-react"
import { toast } from "sonner"

import {
  ARCHIVE_MONTH_OPTIONS,
  ARCHIVE_TARGETS,
  ARCHIVE_TARGET_INFO,
  type ArchiveTarget,
} from "@/lib/archive/targets"
import {
  deleteArchiveFileAction,
  restoreStoredArchiveAction,
  restoreUploadedArchiveAction,
  runArchiveAction,
  type ArchiveActionState,
} from "@/server/actions/archive"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export type ArchiveCounts = Record<ArchiveTarget, Record<number, { rows: number; cutoff: string }>>

export type ArchiveHistoryRow = {
  publicId: string
  target: ArchiveTarget
  targetLabel: string
  cutoff: string
  rowCount: number
  fileName: string
  fileSizeBytes: number
  onServer: boolean
  createdAt: string
  createdByUsername: string
  lastRestoredAt: string | null
  lastRestoredRows: number | null
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`
}

function formatDate(iso: string, withTime = false) {
  return new Date(iso).toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  })
}

function useActionToast() {
  const router = useRouter()
  return (result: ArchiveActionState) => {
    if (result?.error) {
      toast.error(result.error)
      return false
    }
    if (result?.message) toast.success(result.message)
    router.refresh()
    return true
  }
}

// ---------- Kartu Arsip & Bersihkan per jenis data ----------

function ArchiveTargetCard({
  target,
  counts,
  lastBackupAt,
}: {
  target: ArchiveTarget
  counts: ArchiveCounts[ArchiveTarget]
  lastBackupAt: string | null
}) {
  const info = ARCHIVE_TARGET_INFO[target]
  const [months, setMonths] = useState(info.defaultMonths)
  const [open, setOpen] = useState(false)
  const [confirmText, setConfirmText] = useState("")
  const [isPending, startTransition] = useTransition()
  const handle = useActionToast()
  const current = counts[months]

  function submit() {
    startTransition(async () => {
      const ok = handle(await runArchiveAction(target, months, confirmText))
      if (ok) {
        setOpen(false)
        setConfirmText("")
      }
    })
  }

  return (
    <div className="flex flex-col rounded-lg border p-4">
      <p className="font-medium">{info.label}</p>
      <p className="text-xs text-muted-foreground">{info.description}</p>

      <p className="mt-4 mb-1.5 text-xs text-muted-foreground">Arsipkan data yang umurnya lebih dari</p>
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Batas umur data">
        {ARCHIVE_MONTH_OPTIONS.map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={months === m}
            onClick={() => setMonths(m)}
            className={cn(
              "h-7 rounded-full border px-3 text-xs transition",
              months === m
                ? "border-primary bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            &gt; {m} bln
          </button>
        ))}
      </div>

      {current.rows > 0 ? (
        // Arsip sendiri sudah berupa file cadangan; info ini memberi tahu
        // apakah baris-baris itu JUGA ada di backup database (lapis kedua).
        lastBackupAt && new Date(lastBackupAt) > new Date(current.cutoff) ? (
          <p className="mt-3 flex items-start gap-1.5 text-xs text-emerald-700 dark:text-emerald-400">
            <ShieldCheck className="mt-px size-3.5 shrink-0" />
            Juga tercakup di backup database {formatDate(lastBackupAt)}.
          </p>
        ) : (
          <p className="mt-3 flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
            <AlertTriangle className="mt-px size-3.5 shrink-0" />
            <span>
              Belum ada di backup database.{" "}
              <a href="/admin/backup/database" className="underline underline-offset-2">
                Backup dulu
              </a>{" "}
              untuk cadangan kedua, atau simpan file arsipnya baik-baik.
            </span>
          </p>
        )
      ) : null}

      <div className="mt-4 flex items-end justify-between gap-3 border-t pt-3">
        <div>
          <p className="text-2xl leading-none font-semibold tabular-nums">{current.rows.toLocaleString("id-ID")}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            baris tercatat <span className="font-medium text-foreground">sebelum {formatDate(current.cutoff)}</span>
          </p>
          <p className="text-xs text-muted-foreground">
            Data {months} bulan terakhir tetap tersimpan.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={current.rows === 0}
          onClick={() => setOpen(true)}
          className="shrink-0"
        >
          <Archive className="size-3.5" />
          Arsip &amp; Bersihkan
        </Button>
      </div>

      <Dialog open={open} onOpenChange={(v) => !isPending && setOpen(v)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Arsipkan &amp; hapus {info.label}?</DialogTitle>
            <DialogDescription>
              {current.rows.toLocaleString("id-ID")} baris sebelum {formatDate(current.cutoff)} akan disimpan
              ke file arsip, diverifikasi, lalu <strong>dihapus dari database</strong>.
            </DialogDescription>
          </DialogHeader>

          <ul className="grid gap-1.5 rounded-lg bg-muted/60 p-3 text-xs">
            <li>• File arsip bisa diunduh, dan di-import ulang kapan saja (data yang ada tidak ditimpa).</li>
            <li>• Kalau verifikasi file gagal, tidak ada data yang dihapus.</li>
            {info.note ? <li>• {info.note}</li> : null}
          </ul>

          <div className="grid gap-2">
            <Label htmlFor={`confirm-${target}`}>
              Ketik <span className="font-mono font-semibold">HAPUS</span> untuk melanjutkan
            </Label>
            <Input
              id={`confirm-${target}`}
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              autoComplete="off"
              disabled={isPending}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
              Batal
            </Button>
            <Button variant="destructive" onClick={submit} disabled={isPending || confirmText.trim() !== "HAPUS"}>
              {isPending ? <Loader2 className="size-4 animate-spin" /> : <Archive className="size-4" />}
              {isPending ? "Memproses..." : "Arsipkan & Hapus"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export function ArchiveTargets({
  counts,
  lastBackups,
}: {
  counts: ArchiveCounts
  lastBackups: Record<ArchiveTarget, string | null>
}) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {ARCHIVE_TARGETS.map((t) => (
        <ArchiveTargetCard key={t} target={t} counts={counts[t]} lastBackupAt={lastBackups[t]} />
      ))}
    </div>
  )
}

// ---------- Riwayat arsip ----------

function HistoryActions({ row }: { row: ArchiveHistoryRow }) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [isPending, startTransition] = useTransition()
  const handle = useActionToast()

  if (!row.onServer) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <ServerOff className="size-3.5" />
        Gunakan Import dari File
      </span>
    )
  }

  return (
    <div className="flex flex-wrap justify-end gap-1.5">
      <Button variant="outline" size="sm" render={<a href={`/api/backup/arsip/${row.publicId}/download`} />} nativeButton={false}>
        <Download className="size-3.5" />
        Unduh
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={isPending}
        onClick={() => startTransition(async () => void handle(await restoreStoredArchiveAction(row.publicId)))}
      >
        {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCcw className="size-3.5" />}
        Import ulang
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(true)} aria-label="Hapus file dari server">
        <Trash2 className="size-3.5" />
      </Button>

      <Dialog open={confirmDelete} onOpenChange={(v) => !isPending && setConfirmDelete(v)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus file arsip dari server?</DialogTitle>
            <DialogDescription>
              Pastikan Anda sudah <strong>mengunduh</strong> {row.fileName}. Setelah dihapus, data ini hanya bisa
              dikembalikan lewat Import dari File memakai salinan unduhan Anda.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)} disabled={isPending}>
              Batal
            </Button>
            <Button
              variant="destructive"
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  if (handle(await deleteArchiveFileAction(row.publicId))) setConfirmDelete(false)
                })
              }
            >
              Hapus dari Server
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export function ArchiveHistory({ rows }: { rows: ArchiveHistoryRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center gap-1 px-5 py-10 text-center">
        <Archive className="size-6 text-muted-foreground" />
        <p className="text-sm font-medium">Belum ada arsip</p>
        <p className="text-xs text-muted-foreground">Arsip yang dibuat akan muncul di sini.</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
          <tr>
            <th className="px-5 py-2.5 font-medium">Dibuat</th>
            <th className="px-5 py-2.5 font-medium">Data</th>
            <th className="px-5 py-2.5 text-right font-medium">Baris</th>
            <th className="px-5 py-2.5 font-medium">File</th>
            <th className="px-5 py-2.5 font-medium">Import terakhir</th>
            <th className="px-5 py-2.5" />
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row) => (
            <tr key={row.publicId}>
              <td className="px-5 py-3 whitespace-nowrap">
                <p>{formatDate(row.createdAt, true)}</p>
                <p className="text-xs text-muted-foreground">oleh {row.createdByUsername}</p>
              </td>
              <td className="px-5 py-3">
                <p className="font-medium">{row.targetLabel}</p>
                <p className="text-xs text-muted-foreground">sebelum {formatDate(row.cutoff)}</p>
              </td>
              <td className="px-5 py-3 text-right font-semibold tabular-nums">{row.rowCount.toLocaleString("id-ID")}</td>
              <td className="px-5 py-3">
                <p className="max-w-56 truncate font-mono text-xs" title={row.fileName}>
                  {row.fileName}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatBytes(row.fileSizeBytes)} · {row.onServer ? "ada di server" : "sudah dihapus dari server"}
                </p>
              </td>
              <td className="px-5 py-3 text-xs text-muted-foreground whitespace-nowrap">
                {row.lastRestoredAt
                  ? `${formatDate(row.lastRestoredAt)} · ${(row.lastRestoredRows ?? 0).toLocaleString("id-ID")} baris`
                  : "—"}
              </td>
              <td className="px-5 py-3">
                <HistoryActions row={row} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ---------- Import dari file ----------

export function ArchiveUpload() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [isPending, startTransition] = useTransition()
  const handle = useActionToast()

  function submit() {
    if (!file) return
    const formData = new FormData()
    formData.append("file", file)
    startTransition(async () => {
      if (handle(await restoreUploadedArchiveAction(formData))) {
        setFile(null)
        if (inputRef.current) inputRef.current.value = ""
      }
    })
  }

  return (
    <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
      <div>
        <p className="text-sm">
          Pilih file arsip <span className="font-mono text-xs">.jsonl.gz</span> hasil unduhan dari halaman ini. Data
          digabungkan: baris yang sudah ada dilewati, tidak ada data yang ditimpa.
        </p>
        <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
          <AlertTriangle className="size-3.5" />
          Maksimal 11 MB per file. File diperiksa keutuhannya sebelum diproses.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept=".gz,application/gzip"
          className="hidden"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <Button variant="outline" onClick={() => inputRef.current?.click()} disabled={isPending}>
          <FileUp className="size-4" />
          {file ? <span className="max-w-48 truncate">{file.name}</span> : "Pilih File"}
        </Button>
        <Button onClick={submit} disabled={!file || isPending}>
          {isPending ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}
          {isPending ? "Mengimport..." : "Import"}
        </Button>
      </div>
    </div>
  )
}
