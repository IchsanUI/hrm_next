"use client"

import { useActionState, useEffect, useRef, useState } from "react"
import {
  CheckCircle2,
  CircleDashed,
  ExternalLink,
  Eye,
  File as FileIcon,
  FileText,
  FileUp,
  Loader2,
} from "lucide-react"
import { toast } from "sonner"

import type { EmployeeDocMeta } from "@/lib/employee-document-meta"
import { cn } from "@/lib/utils"

import {
  uploadEmployeeDocumentAction,
  type DocumentUploadState,
  type EmployeeDocType,
} from "@/server/actions/employee-documents"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"

type MaritalStatus = "SINGLE" | "MARRIED" | "DIVORCED" | "WIDOWED" | null

function maritalDocLabel(maritalStatus: MaritalStatus) {
  if (maritalStatus === "MARRIED") return "Surat Nikah"
  if (maritalStatus === "DIVORCED") return "Akta Cerai"
  return "Surat Nikah / Akta Cerai"
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`
}

function DocumentSlot({
  employeeId,
  employeePublicId,
  docType,
  label,
  meta,
}: {
  employeeId: number
  employeePublicId: string
  docType: EmployeeDocType
  label: string
  meta: EmployeeDocMeta
}) {
  const hasFile = meta !== null
  const [thumbFailed, setThumbFailed] = useState(false)
  const viewHref = `/api/pegawai/${employeePublicId}/dokumen/${docType}`
  const [open, setOpen] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewLoading, setPreviewLoading] = useState(true)
  const [previewError, setPreviewError] = useState(false)
  // Kunci per pembukaan popup — memaksa browser mengambil ulang dokumen
  // (watermark memuat nama & jam akses, jadi tidak boleh pakai versi cache).
  const [previewKey, setPreviewKey] = useState(0)

  function openPreview() {
    setPreviewLoading(true)
    setPreviewError(false)
    setPreviewKey((k) => k + 1)
    setPreviewOpen(true)
  }
  const action = uploadEmployeeDocumentAction.bind(null, employeeId, docType)
  const [state, formAction, isPending] = useActionState<DocumentUploadState, FormData>(
    action,
    undefined
  )
  const formRef = useRef<HTMLFormElement>(null)
  const wasPending = useRef(false)

  useEffect(() => {
    if (!wasPending.current || isPending) {
      wasPending.current = isPending
      return
    }
    wasPending.current = isPending
    if (state?.error) {
      toast.error(state.error)
      return
    }
    if (state?.success) {
      toast.success(`${label} berhasil diunggah.`)
      formRef.current?.reset()
      // Ditunda satu tick (pola sama dengan ApproveDialog) — setState langsung
      // di badan effect memicu render berantai.
      const id = setTimeout(() => setOpen(false), 0)
      return () => clearTimeout(id)
    }
  }, [isPending, state, label])

  return (
    <div className={cn("flex flex-col gap-3 rounded-lg border p-3", !hasFile && "border-dashed")}>
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-sm font-medium">{label}</p>
        {hasFile ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="size-3" />
            Terisi
          </span>
        ) : (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
            <CircleDashed className="size-3" />
            Kosong
          </span>
        )}
      </div>

      {/* Area thumbnail — gambar ditampilkan buram (isi tidak terbaca); isi
          asli hanya lewat "Lihat" yang ber-watermark & tercatat di log. */}
      {hasFile ? (
        <button
          type="button"
          onClick={openPreview}
          className="group relative flex h-28 items-center justify-center overflow-hidden rounded-md border bg-muted/50"
          aria-label={`Pratinjau ${label}`}
        >
          {meta.kind === "image" && !thumbFailed ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`${viewHref}/thumbnail?v=${encodeURIComponent(meta.uploadedAt)}`}
              alt=""
              className="size-full object-cover"
              onError={() => setThumbFailed(true)}
            />
          ) : meta.kind === "pdf" ? (
            <div className="flex flex-col items-center gap-1 text-rose-600 dark:text-rose-400">
              <FileText className="size-8" strokeWidth={1.5} />
              <span className="text-xs font-semibold">
                PDF{meta.pages ? ` · ${meta.pages} halaman` : ""}
              </span>
            </div>
          ) : (
            <FileIcon className="size-8 text-muted-foreground" strokeWidth={1.5} />
          )}
          <span className="absolute inset-0 flex items-center justify-center gap-1.5 bg-black/45 text-xs font-medium text-white opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
            <Eye className="size-4" />
            Lihat dokumen
          </span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex h-28 flex-col items-center justify-center gap-1 rounded-md border border-dashed bg-muted/30 text-muted-foreground transition hover:bg-muted/60"
        >
          <FileUp className="size-7" strokeWidth={1.5} />
          <span className="text-xs">Belum diunggah</span>
        </button>
      )}

      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 truncate text-xs text-muted-foreground">
          {hasFile
            ? `${formatBytes(meta.sizeBytes)} · ${new Date(meta.uploadedAt).toLocaleDateString("id-ID", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}`
            : "PDF, JPG, atau PNG"}
        </p>
        <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => setOpen(true)}>
          {hasFile ? "Ganti" : "Upload"}
        </Button>
      </div>

      {/* Popup pratinjau — memuat dokumen ASLI lewat route yang sama dengan
          "buka di tab baru", jadi tetap ber-watermark & tercatat di log. */}
      {hasFile ? (
        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent className="flex max-h-[92vh] flex-col gap-3 sm:max-w-4xl">
            <DialogHeader>
              <DialogTitle>{label}</DialogTitle>
              <DialogDescription>
                {meta.kind === "pdf" ? `PDF${meta.pages ? ` · ${meta.pages} halaman` : ""} · ` : ""}
                {formatBytes(meta.sizeBytes)} · diunggah{" "}
                {new Date(meta.uploadedAt).toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" })}
                . Akses ini tercatat di Log Aktivitas.
              </DialogDescription>
            </DialogHeader>

            <div className="relative flex min-h-[50vh] flex-1 items-center justify-center overflow-auto rounded-lg border bg-muted/40">
              {previewLoading && !previewError ? (
                <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Memuat dokumen...
                </div>
              ) : null}
              {previewError ? (
                <div className="flex flex-col items-center gap-2 p-6 text-center text-sm text-muted-foreground">
                  <FileIcon className="size-8" strokeWidth={1.5} />
                  Dokumen gagal dimuat di sini. Coba buka di tab baru.
                </div>
              ) : meta.kind === "pdf" ? (
                <iframe
                  key={previewKey}
                  src={`${viewHref}?p=${previewKey}#view=FitH`}
                  title={`Pratinjau ${label}`}
                  className="h-[70vh] w-full rounded-lg"
                  onLoad={() => setPreviewLoading(false)}
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={previewKey}
                  src={`${viewHref}?p=${previewKey}`}
                  alt={label}
                  className="max-h-[70vh] w-auto object-contain"
                  onLoad={() => setPreviewLoading(false)}
                  onError={() => {
                    setPreviewLoading(false)
                    setPreviewError(true)
                  }}
                />
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" nativeButton={false} render={<a href={viewHref} target="_blank" rel="noopener noreferrer" />}>
                <ExternalLink className="size-4" />
                Buka di tab baru
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setPreviewOpen(false)
                  setOpen(true)
                }}
              >
                Ganti dokumen
              </Button>
              <Button onClick={() => setPreviewOpen(false)}>Tutup</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload {label}</DialogTitle>
            <DialogDescription>Format PDF, JPG, atau PNG. Maksimal 5MB.</DialogDescription>
          </DialogHeader>
          <form ref={formRef} action={formAction} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor={`file-${docType}`}>File</Label>
              <Input
                id={`file-${docType}`}
                name="file"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                required
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Mengunggah..." : "Upload"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export function EmployeePersonalDocumentsCard({
  employeeId,
  employeePublicId,
  maritalStatus,
  documents,
}: {
  employeeId: number
  employeePublicId: string
  maritalStatus: MaritalStatus
  documents: Record<EmployeeDocType, EmployeeDocMeta>
}) {
  const slots: { docType: EmployeeDocType; label: string }[] = [
    { docType: "ktp", label: "KTP" },
    { docType: "kk", label: "Kartu Keluarga" },
    { docType: "npwp", label: "NPWP" },
    { docType: "marital", label: maritalDocLabel(maritalStatus) },
  ]
  const filled = slots.filter((s) => documents[s.docType] !== null).length

  return (
    <Card>
      <CardHeader className="border-b">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <CardTitle>Dokumen Pribadi</CardTitle>
          <span
            className={cn(
              "rounded-full px-2.5 py-0.5 text-xs font-medium tabular-nums",
              filled === slots.length
                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                : "bg-amber-500/15 text-amber-700 dark:text-amber-400"
            )}
          >
            {filled} dari {slots.length} terisi
          </span>
        </div>
        <CardDescription>
          Scan KTP, Kartu Keluarga, NPWP, dan Surat Nikah/Akta Cerai — cuma bisa dilihat oleh
          Super Admin/HR Admin dan pegawai yang bersangkutan. Pratinjau sengaja diburamkan; klik
          untuk melihat dokumen asli (ber-watermark &amp; tercatat di log).
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 pt-4 sm:grid-cols-2 lg:grid-cols-4">
        {slots.map((s) => (
          <DocumentSlot
            key={s.docType}
            employeeId={employeeId}
            employeePublicId={employeePublicId}
            docType={s.docType}
            label={s.label}
            meta={documents[s.docType]}
          />
        ))}
      </CardContent>
    </Card>
  )
}
