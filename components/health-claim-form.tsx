"use client"

import { useEffect, useMemo, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Camera, FileText, Loader2, Upload, X } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { compressImage } from "@/lib/compress-image"
import { formatRupiah } from "@/lib/health-claim-labels"
import { resubmitHealthClaimAction, submitHealthClaimAction } from "@/server/actions/health-claims"
import { cn } from "@/lib/utils"

export type ClaimTypeOption = {
  publicId: string
  name: string
  description: string | null
  requiredDocumentLabel: string | null
}
export type PatientOption = { value: string; label: string; hint: string }
export type ExistingClaimDocument = { id: number; publicId: string; originalName: string; isPdf: boolean }
export type ClaimFormInitial = {
  claimPublicId: string
  patient: string
  typeId: string
  treatmentDate: string
  dischargeDate: string
  facility: string
  diagnosis: string
  amount: number
  documents: ExistingClaimDocument[]
}

// Batas upload server action 12 MB (next.config.ts) — sisakan ruang untuk
// field teks & overhead multipart.
const MAX_TOTAL_BYTES = 11 * 1024 * 1024
const MAX_FILES = 5

function parseAmount(raw: string) {
  const digits = raw.replace(/\D/g, "")
  return digits ? Number(digits) : 0
}

function shiftDate(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function formatIso(iso: string) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" })
}

// Thumbnail file baru: gambar ditampilkan langsung, PDF sebagai kartu.
function NewFileThumb({ file, onRemove }: { file: File; onRemove: () => void }) {
  const url = useMemo(() => (file.type.startsWith("image/") ? URL.createObjectURL(file) : null), [file])
  useEffect(() => () => {
    if (url) URL.revokeObjectURL(url)
  }, [url])
  return (
    <Thumb name={file.name} sizeLabel={`${Math.max(1, Math.round(file.size / 1024))} KB`} imageUrl={url} isPdf={file.type === "application/pdf"} onRemove={onRemove} />
  )
}

function Thumb({
  name,
  sizeLabel,
  imageUrl,
  isPdf,
  href,
  onRemove,
  removed,
}: {
  name: string
  sizeLabel?: string
  imageUrl: string | null
  isPdf: boolean
  href?: string
  onRemove: () => void
  removed?: boolean
}) {
  const body = (
    <div className={cn("flex aspect-[3/4] items-center justify-center overflow-hidden rounded-md border bg-muted/40", removed && "opacity-40")}>
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- pratinjau lokal (blob:) / file terproteksi, bukan aset statis
        <img src={imageUrl} alt={name} className="h-full w-full object-cover" />
      ) : (
        <span className="flex flex-col items-center gap-1 text-muted-foreground">
          <FileText className="size-8" />
          <span className="text-xs font-semibold">{isPdf ? "PDF" : "File"}</span>
        </span>
      )}
    </div>
  )
  return (
    <div className="group relative">
      {href ? (
        <a href={href} target="_blank" rel="noopener noreferrer" title="Buka file">
          {body}
        </a>
      ) : (
        body
      )}
      <button
        type="button"
        onClick={onRemove}
        aria-label={removed ? `Batal hapus ${name}` : `Hapus ${name}`}
        className="absolute top-1.5 right-1.5 flex size-6 items-center justify-center rounded-full bg-background/90 shadow ring-1 ring-border hover:bg-background"
      >
        <X className="size-3.5" />
      </button>
      <p className={cn("mt-1 truncate text-xs", removed && "text-muted-foreground line-through")} title={name}>
        {name}
      </p>
      {sizeLabel || removed ? (
        <p className="text-[11px] text-muted-foreground">{removed ? "akan dihapus" : sizeLabel}</p>
      ) : null}
    </div>
  )
}

export function HealthClaimForm({
  types,
  patients,
  remainingPlafon,
  deadlineDays,
  initial,
}: {
  types: ClaimTypeOption[]
  patients: PatientOption[]
  remainingPlafon: number
  deadlineDays: number | null
  initial?: ClaimFormInitial
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [preparing, setPreparing] = useState(false)
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" })
  // Tanggal paling awal yang masih boleh diklaim sesuai aturan batas pengajuan.
  const earliest = deadlineDays !== null ? shiftDate(today, -deadlineDays) : undefined

  const [patient, setPatient] = useState(initial?.patient ?? "SELF")
  const [typeId, setTypeId] = useState(initial?.typeId ?? "")
  const [treatmentDate, setTreatmentDate] = useState(initial?.treatmentDate ?? "")
  const [dischargeDate, setDischargeDate] = useState(initial?.dischargeDate ?? "")
  const [facility, setFacility] = useState(initial?.facility ?? "")
  const [diagnosis, setDiagnosis] = useState(initial?.diagnosis ?? "")
  const [amount, setAmount] = useState(initial?.amount ? initial.amount.toLocaleString("id-ID") : "")
  const [files, setFiles] = useState<File[]>([])
  const [removedDocs, setRemovedDocs] = useState<Set<number>>(() => new Set())
  const [agreed, setAgreed] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const existingDocs = initial?.documents ?? []
  const keptDocCount = existingDocs.filter((d) => !removedDocs.has(d.id)).length
  const fileCount = keptDocCount + files.length
  const type = types.find((t) => t.publicId === typeId)
  const isInpatient = Boolean(type && /inap|persalinan/i.test(type.name))
  const requested = parseAmount(amount)
  const payable = Math.min(requested, remainingPlafon)
  const typeOptions = useMemo(() => types.map((t) => ({ value: t.publicId, label: t.name })), [types])

  // Rawat inap: batas dihitung dari tanggal keluar; selain itu dari tanggal berobat.
  const deadlineDate = isInpatient ? dischargeDate : treatmentDate
  const dateError =
    !deadlineDate
      ? null
      : deadlineDate > today
        ? "Tanggal tidak boleh di masa depan."
        : earliest && deadlineDate < earliest
          ? `Melewati batas pengajuan ${deadlineDays} hari. Tanggal paling awal ${formatIso(earliest)}.`
          : isInpatient && treatmentDate && dischargeDate && dischargeDate < treatmentDate
            ? "Tanggal keluar tidak boleh sebelum tanggal masuk."
            : null

  async function addFiles(incoming: File[]) {
    setPreparing(true)
    try {
      const prepared: File[] = []
      for (const f of incoming) {
        if (fileCount + prepared.length >= MAX_FILES) {
          toast.error(`Maksimal ${MAX_FILES} file bukti per klaim.`)
          break
        }
        if (!["application/pdf", "image/jpeg", "image/png"].includes(f.type)) {
          toast.error(`"${f.name}" harus berformat PDF, JPG, atau PNG.`)
          continue
        }
        // Foto diperkecil seperlunya, tetap cukup tajam untuk arsip.
        const file = f.type.startsWith("image/") ? await compressImage(f, { maxDimension: 2400, quality: 0.85 }) : f
        if (file.size > 5 * 1024 * 1024) {
          toast.error(`"${f.name}" melebihi 5 MB.`)
          continue
        }
        prepared.push(file)
      }
      setFiles((prev) => [...prev, ...prepared])
    } finally {
      setPreparing(false)
    }
  }

  function submit() {
    if (!typeId) return toast.error("Pilih jenis klaim.")
    if (!treatmentDate || (isInpatient && !dischargeDate)) return toast.error("Isi tanggal berobat.")
    if (dateError) return toast.error(dateError)
    if (!facility.trim()) return toast.error("Isi nama fasilitas kesehatan.")
    if (requested <= 0) return toast.error("Isi jumlah yang diklaim.")
    if (fileCount === 0) return toast.error("Unggah foto atau scan kuitansi/nota.")
    if (files.reduce((s, f) => s + f.size, 0) > MAX_TOTAL_BYTES) {
      return toast.error("Total ukuran file terlalu besar (maks. 11 MB). Kurangi atau perkecil file.")
    }

    const fd = new FormData()
    fd.set("patient", patient)
    fd.set("typePublicId", typeId)
    fd.set("treatmentDate", treatmentDate)
    if (isInpatient && dischargeDate) fd.set("dischargeDate", dischargeDate)
    fd.set("facility", facility)
    fd.set("diagnosis", diagnosis)
    fd.set("amount", String(requested))
    if (agreed) fd.set("statementAgreed", "on")
    files.forEach((f) => fd.append("receipts", f))
    removedDocs.forEach((id) => fd.append("removeDocuments", String(id)))

    startTransition(async () => {
      const result = initial
        ? await resubmitHealthClaimAction(initial.claimPublicId, fd)
        : await submitHealthClaimAction(fd)
      if ("error" in result) {
        toast.error(result.error)
        return
      }
      toast.success(result.success)
      router.push(`/pegawai/klaim-kesehatan/${result.publicId}`)
    })
  }

  const busy = isPending || preparing

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="grid content-start gap-6">
        <Card>
          <CardHeader className="border-b">
            <CardTitle>Pasien & Pengobatan</CardTitle>
            <CardDescription>Siapa yang berobat, kapan, dan di mana.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5 pt-2">
            <div className="grid gap-2">
              <Label>Pasien</Label>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {patients.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setPatient(p.value)}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                      patient === p.value ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted/50"
                    )}
                    aria-pressed={patient === p.value}
                  >
                    <span className="block font-medium">{p.label}</span>
                    <span className="text-xs text-muted-foreground">{p.hint}</span>
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Keluarga yang belum muncul berarti belum terdaftar di data Keluarga. Hubungi HR untuk menambahkannya.
              </p>
            </div>

            <div className="grid gap-1.5">
              <Label>
                Jenis klaim <span className="text-destructive">*</span>
              </Label>
              <Select value={typeId} onValueChange={(v) => setTypeId(String(v ?? ""))} items={typeOptions}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Pilih jenis klaim" />
                </SelectTrigger>
                <SelectContent>
                  {typeOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {type?.description ? <p className="text-xs text-muted-foreground">{type.description}</p> : null}
            </div>

            <div className={cn("grid gap-4", isInpatient && "sm:grid-cols-2")}>
              <div className="grid gap-1.5">
                <Label htmlFor="treatmentDate">
                  {isInpatient ? "Tanggal masuk" : "Tanggal berobat"} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="treatmentDate"
                  type="date"
                  required
                  className="w-full"
                  min={isInpatient ? undefined : earliest}
                  max={isInpatient && dischargeDate ? dischargeDate : today}
                  value={treatmentDate}
                  aria-invalid={!isInpatient && Boolean(dateError)}
                  onChange={(e) => setTreatmentDate(e.target.value)}
                />
              </div>
              {isInpatient ? (
                <div className="grid gap-1.5">
                  <Label htmlFor="dischargeDate">
                    Tanggal keluar <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="dischargeDate"
                    type="date"
                    required
                    className="w-full"
                    min={treatmentDate && earliest ? (treatmentDate > earliest ? treatmentDate : earliest) : treatmentDate || earliest}
                    max={today}
                    value={dischargeDate}
                    aria-invalid={Boolean(dateError)}
                    onChange={(e) => setDischargeDate(e.target.value)}
                  />
                </div>
              ) : null}
            </div>
            {dateError ? (
              <p className="-mt-3 text-xs text-destructive">{dateError}</p>
            ) : deadlineDays !== null && earliest ? (
              <p className="-mt-3 text-xs text-muted-foreground">
                Klaim diajukan paling lambat {deadlineDays} hari setelah {isInpatient ? "tanggal keluar" : "tanggal berobat"}
                , jadi tanggal paling awal yang bisa dipilih adalah {formatIso(earliest)}.
              </p>
            ) : null}

            <div className="grid gap-1.5">
              <Label htmlFor="facility">
                Fasilitas kesehatan <span className="text-destructive">*</span>
              </Label>
              <Input
                id="facility"
                required
                placeholder="Nama klinik, rumah sakit, atau apotek"
                value={facility}
                onChange={(e) => setFacility(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="diagnosis">Diagnosa / keluhan (opsional)</Label>
              <Textarea id="diagnosis" rows={2} value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} />
              <p className="text-xs text-muted-foreground">Disimpan terenkripsi dan tidak dicetak di Nota Dinas.</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <CardTitle>Jumlah yang Diklaim</CardTitle>
            <CardDescription>
              Isi total semua biaya yang diklaim sesuai kuitansi/nota. Petugas akan memeriksa dan menyesuaikan bila ada
              biaya yang tidak bisa diklaim.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-1.5 pt-2">
            <Label htmlFor="amount">
              Total klaim <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">Rp</span>
              <Input
                id="amount"
                inputMode="numeric"
                required
                className="pl-9 text-right text-base font-semibold tabular-nums"
                placeholder="0"
                value={amount}
                onChange={(e) => {
                  const n = parseAmount(e.target.value)
                  setAmount(n ? n.toLocaleString("id-ID") : "")
                }}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <CardTitle>Kuitansi / Nota & Dokumen Pendukung</CardTitle>
            <CardDescription>
              Wajib. PDF, JPG, atau PNG, maksimal {MAX_FILES} file (5 MB per file).
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 pt-2">
            <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2.5 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
              <Camera className="mt-0.5 size-4 shrink-0" />
              <span>
                Bukti akan <span className="font-medium">diarsipkan</span>. Usahakan hasil <span className="font-medium">scan</span>;
                bila difoto, pastikan pencahayaan terang, dokumen terlihat utuh (tidak terpotong), dan nama faskes, tanggal,
                serta nominal terbaca jelas.
                {type?.requiredDocumentLabel ? (
                  <>
                    {" "}
                    Untuk {type.name}, sertakan juga <span className="font-medium">{type.requiredDocumentLabel.toLowerCase()}</span>.
                  </>
                ) : null}
              </span>
            </div>

            {existingDocs.length + files.length > 0 ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
                {existingDocs.map((d) => (
                  <Thumb
                    key={d.id}
                    name={d.originalName}
                    imageUrl={d.isPdf ? null : `/api/klaim-kesehatan/dokumen/${d.publicId}`}
                    isPdf={d.isPdf}
                    href={`/api/klaim-kesehatan/dokumen/${d.publicId}`}
                    removed={removedDocs.has(d.id)}
                    onRemove={() =>
                      setRemovedDocs((prev) => {
                        const next = new Set(prev)
                        if (next.has(d.id)) next.delete(d.id)
                        else next.add(d.id)
                        return next
                      })
                    }
                  />
                ))}
                {files.map((f, i) => (
                  <NewFileThumb key={`${f.name}-${i}`} file={f} onRemove={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))} />
                ))}
              </div>
            ) : null}

            <input
              ref={fileRef}
              type="file"
              accept="application/pdf,image/jpeg,image/png"
              multiple
              className="hidden"
              onChange={(e) => {
                const picked = Array.from(e.target.files ?? [])
                e.target.value = ""
                void addFiles(picked)
              }}
            />
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                variant="outline"
                disabled={busy || fileCount >= MAX_FILES}
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="size-4" />
                Pilih file
              </Button>
              <span className="text-xs text-muted-foreground tabular-nums">
                {fileCount} / {MAX_FILES} file
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid content-start gap-4 self-start lg:sticky lg:top-4">
        <Card>
          <CardContent className="grid gap-3 text-sm">
            <p className="font-medium">Ringkasan</p>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Jumlah diklaim</span>
              <span className="tabular-nums">{formatRupiah(requested)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Sisa plafon</span>
              <span className="tabular-nums">{formatRupiah(remainingPlafon)}</span>
            </div>
            <div className="flex justify-between border-t pt-2">
              <span className="font-medium">Perkiraan dapat dibayar</span>
              <span className="font-semibold tabular-nums">{formatRupiah(payable)}</span>
            </div>
            {requested > remainingPlafon ? (
              <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                Jumlah melebihi sisa plafon. Klaim tetap bisa diajukan, tetapi yang dibayar paling banyak sebesar sisa
                plafon.
              </p>
            ) : null}
            <p className="text-xs text-muted-foreground">Nominal akhir ditentukan setelah pemeriksaan petugas.</p>

            <label className="mt-1 flex items-start gap-2.5 rounded-md border p-3">
              <Checkbox className="mt-0.5" checked={agreed} onCheckedChange={(v) => setAgreed(v === true)} />
              <span className="text-xs leading-relaxed">
                Saya menyatakan data dan bukti yang saya lampirkan benar dan dapat dipertanggungjawabkan.
              </span>
            </label>

            <Button onClick={submit} disabled={busy || !agreed}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              {preparing ? "Menyiapkan file..." : isPending ? "Mengirim..." : initial ? "Kirim Perbaikan" : "Kirim Klaim"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
