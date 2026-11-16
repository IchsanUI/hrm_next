"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { AlertTriangle, ArrowRight, FileX2, Loader2, Pencil, Trash2 } from "lucide-react"
import { toast } from "sonner"

import type { HistoryFormState } from "@/server/actions/employee-history"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

// Aksi Edit & Hapus per baris untuk semua bagian riwayat pegawai. Keduanya
// sengaja dibuat "sadar": Edit menampilkan ringkasan perubahan (lama → baru)
// sebelum disimpan, Hapus menampilkan data yang akan dihapus — dan keduanya
// memperingatkan bahwa file pendukung lama akan dihapus permanen.

export type HistoryField =
  | { name: string; label: string; kind: "date" | "text"; required?: boolean; span?: 1 | 2 | 3 }
  | { name: string; label: string; kind: "select"; options: { value: string; label: string }[]; required?: boolean; span?: 1 | 2 | 3 }

function displayValue(field: HistoryField, value: string) {
  if (!value) return "—"
  if (field.kind === "date") {
    return new Date(`${value}T00:00:00`).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })
  }
  if (field.kind === "select") return field.options.find((o) => o.value === value)?.label ?? value
  return value
}

function fileName(url: string) {
  const base = url.split("/").pop() ?? url
  // Format simpanan: <employeeId>-<timestamp>-<nama asli>
  return base.replace(/^\d+-\d+-/, "")
}

export function HistoryRowActions({
  entityLabel,
  summary,
  fields,
  initialValues,
  fileUrl,
  onUpdate,
  onDelete,
}: {
  entityLabel: string // mis. "riwayat pelatihan"
  summary: string // ringkasan baris untuk dialog hapus
  fields: HistoryField[]
  initialValues: Record<string, string>
  fileUrl?: string | null // undefined = jenis data ini tidak punya file pendukung
  onUpdate: (formData: FormData) => Promise<HistoryFormState>
  onDelete: () => Promise<HistoryFormState>
}) {
  const supportsFile = fileUrl !== undefined
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [step, setStep] = useState<"form" | "confirm">("form")
  const [values, setValues] = useState(initialValues)
  const [newFile, setNewFile] = useState<File | null>(null)
  const [removeFile, setRemoveFile] = useState(false)
  const [isPending, startTransition] = useTransition()

  function openEdit() {
    setValues(initialValues)
    setNewFile(null)
    setRemoveFile(false)
    setStep("form")
    setEditOpen(true)
  }

  const changes = fields
    .filter((f) => (values[f.name] ?? "").trim() !== (initialValues[f.name] ?? "").trim())
    .map((f) => ({ label: f.label, from: displayValue(f, initialValues[f.name] ?? ""), to: displayValue(f, values[f.name] ?? "") }))
  const fileAction: "replace" | "add" | "remove" | null = newFile
    ? fileUrl
      ? "replace"
      : "add"
    : removeFile && fileUrl
      ? "remove"
      : null

  function goToConfirm() {
    const missing = fields.find((f) => f.required && !(values[f.name] ?? "").trim())
    if (missing) {
      toast.error(`${missing.label} wajib diisi.`)
      return
    }
    if (changes.length === 0 && !fileAction) {
      toast.info("Tidak ada perubahan.")
      return
    }
    setStep("confirm")
  }

  function save() {
    const formData = new FormData()
    for (const f of fields) formData.set(f.name, values[f.name] ?? "")
    if (newFile) formData.set("file", newFile)
    if (fileAction === "remove") formData.set("removeFile", "1")
    startTransition(async () => {
      const result = await onUpdate(formData)
      if (result?.error) {
        toast.error(result.error)
        return
      }
      toast.success(`Data ${entityLabel} diperbarui.`)
      setEditOpen(false)
    })
  }

  function confirmDelete() {
    startTransition(async () => {
      const result = await onDelete()
      if (result?.error) {
        toast.error(result.error)
        return
      }
      toast.success(`Data ${entityLabel} dihapus.`)
      setDeleteOpen(false)
    })
  }

  return (
    <div className="flex gap-1.5">
      <Button variant="outline" size="sm" onClick={openEdit}>
        <Pencil className="size-3.5" />
        Edit
      </Button>
      <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
        Hapus
      </Button>

      {/* ---------- Edit ---------- */}
      <Dialog open={editOpen} onOpenChange={(v) => !isPending && setEditOpen(v)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{step === "form" ? `Edit ${entityLabel}` : "Periksa perubahan"}</DialogTitle>
            <DialogDescription>
              {step === "form"
                ? "Data lama akan ditimpa setelah disimpan. Perubahan tercatat di Log Aktivitas."
                : "Pastikan perubahan di bawah sudah benar sebelum disimpan."}
            </DialogDescription>
          </DialogHeader>

          {step === "form" ? (
            <div className="grid gap-4 sm:grid-cols-3">
              {fields.map((f) => (
                <div
                  key={f.name}
                  className={f.span === 3 ? "grid gap-2 sm:col-span-3" : f.span === 2 ? "grid gap-2 sm:col-span-2" : "grid gap-2"}
                >
                  <Label htmlFor={`edit-${f.name}`}>
                    {f.label}
                    {f.required ? null : <span className="font-normal text-muted-foreground"> (opsional)</span>}
                  </Label>
                  {f.kind === "select" ? (
                    <Select
                      value={values[f.name] ?? ""}
                      onValueChange={(v) => setValues((prev) => ({ ...prev, [f.name]: v ?? "" }))}
                      items={f.options}
                    >
                      <SelectTrigger className="w-full" id={`edit-${f.name}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {f.options.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      id={`edit-${f.name}`}
                      type={f.kind === "date" ? "date" : "text"}
                      value={values[f.name] ?? ""}
                      onChange={(e) => setValues((prev) => ({ ...prev, [f.name]: e.target.value }))}
                    />
                  )}
                </div>
              ))}

              {supportsFile ? (
                <div className="grid gap-2 rounded-lg border p-3 sm:col-span-3">
                  <Label>File Pendukung</Label>
                  {fileUrl ? (
                    <p className="text-xs text-muted-foreground">
                      File saat ini:{" "}
                      <Link href={fileUrl} target="_blank" className="font-medium text-primary hover:underline">
                        {fileName(fileUrl)}
                      </Link>
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">Belum ada file.</p>
                  )}
                  <Input
                    type="file"
                    onChange={(e) => {
                      setNewFile(e.target.files?.[0] ?? null)
                      if (e.target.files?.[0]) setRemoveFile(false)
                    }}
                  />
                  {fileUrl && !newFile ? (
                    <label className="flex items-center gap-2 text-xs">
                      <Checkbox checked={removeFile} onCheckedChange={(c) => setRemoveFile(c === true)} />
                      Hapus file saat ini tanpa mengganti
                    </label>
                  ) : null}
                  {fileAction === "replace" || fileAction === "remove" ? (
                    <p className="flex items-start gap-1.5 text-xs text-destructive">
                      <AlertTriangle className="mt-px size-3.5 shrink-0" />
                      File lama akan dihapus permanen dari server setelah disimpan.
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="grid gap-3">
              {changes.length > 0 ? (
                <ul className="divide-y rounded-lg border text-sm">
                  {changes.map((c) => (
                    <li key={c.label} className="grid gap-1 px-3 py-2">
                      <p className="text-xs text-muted-foreground">{c.label}</p>
                      <p className="flex flex-wrap items-center gap-2">
                        <span className="text-muted-foreground line-through">{c.from}</span>
                        <ArrowRight className="size-3.5 text-muted-foreground" />
                        <span className="font-medium">{c.to}</span>
                      </p>
                    </li>
                  ))}
                </ul>
              ) : null}
              {fileAction ? (
                <div
                  className={
                    fileAction === "add"
                      ? "rounded-lg border p-3 text-sm"
                      : "flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm"
                  }
                >
                  {fileAction === "add" ? (
                    <p>
                      File baru ditambahkan: <span className="font-medium">{newFile?.name}</span>
                    </p>
                  ) : (
                    <>
                      <FileX2 className="mt-0.5 size-4 shrink-0 text-destructive" />
                      <p>
                        File lama <span className="font-medium">{fileUrl ? fileName(fileUrl) : ""}</span> akan{" "}
                        <strong>dihapus permanen</strong> dari server
                        {fileAction === "replace" ? (
                          <>
                            {" "}
                            dan diganti <span className="font-medium">{newFile?.name}</span>
                          </>
                        ) : null}
                        . Tindakan ini tidak bisa dibatalkan.
                      </p>
                    </>
                  )}
                </div>
              ) : null}
            </div>
          )}

          <DialogFooter>
            {step === "form" ? (
              <>
                <Button variant="outline" onClick={() => setEditOpen(false)}>
                  Batal
                </Button>
                <Button onClick={goToConfirm}>Lanjut</Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => setStep("form")} disabled={isPending}>
                  Kembali
                </Button>
                <Button onClick={save} disabled={isPending}>
                  {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
                  {isPending ? "Menyimpan..." : "Ya, Simpan Perubahan"}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------- Hapus ---------- */}
      <Dialog open={deleteOpen} onOpenChange={(v) => !isPending && setDeleteOpen(v)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus {entityLabel}?</DialogTitle>
            <DialogDescription>Data berikut akan dihapus permanen dan tidak bisa dikembalikan.</DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border bg-muted/40 p-3 text-sm">{summary}</div>
          {fileUrl ? (
            <p className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">
              <FileX2 className="mt-0.5 size-4 shrink-0 text-destructive" />
              <span>
                File pendukung <span className="font-medium">{fileName(fileUrl)}</span> juga ikut dihapus permanen
                dari server.
              </span>
            </p>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={isPending}>
              Batal
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={isPending}>
              {isPending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              {isPending ? "Menghapus..." : "Ya, Hapus"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
