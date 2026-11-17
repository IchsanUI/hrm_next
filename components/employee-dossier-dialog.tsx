"use client"

import { useMemo, useState } from "react"
import { Download, Eye, FileStack, Loader2, ShieldCheck } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DOSSIER_ATTACHMENT_PARTS,
  DOSSIER_CV_PARTS,
  type DossierAttachmentPart,
  type DossierCvPart,
  type DossierPart,
} from "@/lib/employee-dossier-parts"

// Tombol "Cetak PDF" di detail pegawai → dialog memilih isi "Berkas
// Pegawai": bagian CV dan/atau lampiran (file utuh). PDF dibuat di server
// (app/api/pegawai/[publicId]/berkas/route.ts) dan diberi watermark.

type Props = {
  employeePublicId: string
  employeeName: string
  cvCounts: Partial<Record<DossierCvPart, number>>
  attachmentCounts: Partial<Record<DossierAttachmentPart, number>>
}

function PartRow({
  label,
  hint,
  count,
  checked,
  disabled,
  onChange,
}: {
  label: string
  hint?: string | null
  count?: number
  checked: boolean
  disabled?: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label
      className={`flex items-start gap-2.5 rounded-md px-2 py-1.5 text-sm ${
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-muted/60"
      }`}
    >
      <Checkbox
        className="mt-0.5"
        checked={checked}
        disabled={disabled}
        onCheckedChange={(v) => onChange(v === true)}
      />
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className="font-medium">{label}</span>
          {count !== undefined ? (
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
              {count === 0 ? "kosong" : `${count}`}
            </span>
          ) : null}
        </span>
        {hint ? <span className="block text-xs text-muted-foreground">{hint}</span> : null}
      </span>
    </label>
  )
}

export function EmployeeDossierDialog({ employeePublicId, employeeName, cvCounts, attachmentCounts }: Props) {
  const availableAttachments = useMemo(
    () => DOSSIER_ATTACHMENT_PARTS.filter((p) => (attachmentCounts[p.key] ?? 0) > 0).map((p) => p.key),
    [attachmentCounts]
  )
  const allCv = useMemo(() => DOSSIER_CV_PARTS.map((p) => p.key), [])

  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<Set<DossierPart>>(() => new Set<DossierPart>([...allCv, ...availableAttachments]))
  const [downloading, setDownloading] = useState(false)

  const toggle = (key: DossierPart, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (on) next.add(key)
      else next.delete(key)
      return next
    })

  const preset = (keys: DossierPart[]) => setSelected(new Set(keys))

  const fileCount = availableAttachments
    .filter((k) => selected.has(k))
    .reduce((sum, k) => sum + (attachmentCounts[k] ?? 0), 0)
  const cvSelected = allCv.filter((k) => selected.has(k)).length
  const query = [...selected].join(",")
  const url = `/api/pegawai/${employeePublicId}/berkas?bagian=${query}`
  const empty = selected.size === 0

  async function handleDownload() {
    setDownloading(true)
    try {
      const response = await fetch(`${url}&unduh=1`)
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        toast.error(body?.error ?? "Berkas gagal dibuat.")
        return
      }
      const blob = await response.blob()
      const href = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = href
      a.download = `Berkas ${employeeName}.pdf`.replace(/[\\/:*?"<>|]/g, "")
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(href), 10_000)
      toast.success("Berkas pegawai berhasil diunduh.")
      setOpen(false)
    } catch {
      toast.error("Berkas gagal diunduh. Periksa koneksi lalu coba lagi.")
    } finally {
      setDownloading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !downloading && setOpen(v)}>
      <DialogTrigger render={<Button type="button" variant="outline" />}>
        <FileStack className="size-4" />
        Cetak PDF
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Cetak Berkas Pegawai</DialogTitle>
          <DialogDescription>
            Pilih isi yang ingin disatukan dalam satu PDF untuk {employeeName}. Lampiran disertakan utuh sesuai
            file aslinya, tidak dipotong.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-1.5">
          <Button size="sm" variant="secondary" onClick={() => preset([...allCv, ...availableAttachments])}>
            Semua
          </Button>
          <Button size="sm" variant="outline" onClick={() => preset(allCv)}>
            CV saja
          </Button>
          <Button size="sm" variant="outline" onClick={() => preset(availableAttachments)} disabled={availableAttachments.length === 0}>
            Lampiran saja
          </Button>
          <Button size="sm" variant="ghost" onClick={() => preset([])}>
            Kosongkan
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border p-2">
            <p className="px-2 pt-1 pb-2 text-xs font-semibold text-muted-foreground uppercase">Isi CV</p>
            {DOSSIER_CV_PARTS.map((p) => (
              <PartRow
                key={p.key}
                label={p.label}
                hint={p.hint}
                count={cvCounts[p.key]}
                checked={selected.has(p.key)}
                onChange={(v) => toggle(p.key, v)}
              />
            ))}
          </div>
          <div className="rounded-lg border p-2">
            <p className="px-2 pt-1 pb-2 text-xs font-semibold text-muted-foreground uppercase">Lampiran (file utuh)</p>
            {DOSSIER_ATTACHMENT_PARTS.map((p) => {
              const count = attachmentCounts[p.key] ?? 0
              return (
                <PartRow
                  key={p.key}
                  label={p.label}
                  count={count}
                  disabled={count === 0}
                  checked={count > 0 && selected.has(p.key)}
                  onChange={(v) => toggle(p.key, v)}
                />
              )
            })}
          </div>
        </div>

        <p className="flex items-start gap-2 rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
          Setiap halaman diberi watermark HRIS Bank Gresik serta nama Anda dan waktu unduh. Unduhan tercatat di log
          aktivitas.
        </p>

        <DialogFooter className="items-center sm:justify-between">
          <span className="text-xs text-muted-foreground">
            {empty ? "Belum ada yang dipilih" : `${cvSelected} bagian CV · ${fileCount} file lampiran`}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={empty || downloading}
              render={empty ? undefined : <a href={url} target="_blank" rel="noopener noreferrer" />}
              nativeButton={empty}
            >
              <Eye className="size-4" />
              Pratinjau
            </Button>
            <Button onClick={handleDownload} disabled={empty || downloading}>
              {downloading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
              {downloading ? "Menyiapkan..." : "Unduh PDF"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
