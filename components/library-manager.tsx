"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import type { LibraryCategory, LibraryTextStatus } from "@prisma/client"
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileSearch,
  FileText,
  Layers,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  ScanText,
  Search,
  Settings2,
  Trash2,
  Upload,
  Users,
} from "lucide-react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import {
  LIBRARY_CATEGORIES,
  LIBRARY_CATEGORY_HINT,
  LIBRARY_CATEGORY_LABEL,
  formatFileSize,
} from "@/lib/library-labels"
import {
  LIBRARY_SETTINGS_LIMITS,
  LIBRARY_TEXT_STATUS_CLASS,
  LIBRARY_TEXT_STATUS_LABEL,
  type LibraryPdfCheck,
  type LibrarySettingsValues,
} from "@/lib/library-text-labels"
import {
  checkLibraryPdfAction,
  createLibraryDocumentAction,
  deleteLibraryDocumentAction,
  getLibraryPagesAction,
  getLibraryReadersAction,
  rereadLibraryTextAction,
  runLibraryOcrAction,
  updateLibraryDocumentAction,
  updateLibrarySettingsAction,
  type LibraryPageText,
  type LibraryReader,
} from "@/server/actions/library"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsList, TabsPanel, TabsTrigger } from "@/components/ui/tabs"

export type LibraryAdminRow = {
  publicId: string
  title: string
  documentNumber: string | null
  category: LibraryCategory
  description: string | null
  effectiveDate: string | null // yyyy-mm-dd
  originalName: string
  sizeBytes: number
  pageCount: number | null
  isPublished: boolean
  uploadedBy: string
  updatedAt: string // ISO
  readerCount: number
  textStatus: LibraryTextStatus
  scanPageCount: number | null
  ocrPageCount: number // halaman scan yang sudah di-OCR
  textError: string | null
  partOfPublicId: string | null // terisi = dokumen ini Bagian 2, 3, …
  partNumber: number | null
  partCount: number // jumlah bagian lanjutan (untuk dokumen utama)
}

const CATEGORY_ITEMS = LIBRARY_CATEGORIES.map((value) => ({ value, label: LIBRARY_CATEGORY_LABEL[value] }))
const MAX_SIZE = 10 * 1024 * 1024

function formatDate(value: string) {
  const date = value.length === 10 ? new Date(`${value}T00:00:00`) : new Date(value)
  return date.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })
}

function fileUrl(publicId: string, download = false) {
  return `/api/perpustakaan/${publicId}/file${download ? "?download=1" : ""}`
}

export function LibraryManager({
  rows,
  activeEmployeeCount,
  textSummary,
  settings,
  ocrEngineAvailable,
  isSuperAdmin,
}: {
  rows: LibraryAdminRow[]
  activeEmployeeCount: number
  textSummary: string[]
  settings: LibrarySettingsValues
  ocrEngineAvailable: boolean
  isSuperAdmin: boolean
}) {
  const [query, setQuery] = useState("")
  const [category, setCategory] = useState<LibraryCategory | "ALL">("ALL")
  const [formTarget, setFormTarget] = useState<LibraryAdminRow | "new" | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<LibraryAdminRow | null>(null)
  const [readersTarget, setReadersTarget] = useState<LibraryAdminRow | null>(null)
  const [textTarget, setTextTarget] = useState<LibraryAdminRow | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const parentTitle = (publicId: string | null) => (publicId ? rows.find((r) => r.publicId === publicId)?.title : null)
  // Dokumen utama yang bisa dipilih sebagai Bagian 1.
  const parentOptions = rows.filter((r) => !r.partOfPublicId)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter(
      (r) =>
        (category === "ALL" || r.category === category) &&
        (!q ||
          r.title.toLowerCase().includes(q) ||
          (r.documentNumber ?? "").toLowerCase().includes(q))
    )
  }, [rows, query, category])

  const countByCategory = (c: LibraryCategory) => rows.filter((r) => r.category === c).length

  return (
    <div className="grid gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative sm:w-80">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari judul atau nomor dokumen"
            className="pl-8"
          />
        </div>
        <div className="flex gap-2">
          {isSuperAdmin ? (
            <Button variant="outline" onClick={() => setSettingsOpen(true)}>
              <Settings2 className="size-4" />
              Pengaturan
            </Button>
          ) : null}
          <Button onClick={() => setFormTarget("new")}>
            <Plus className="size-4" />
            Tambah Dokumen
          </Button>
        </div>
      </div>

      {textSummary.length ? (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <FileSearch className="size-3.5 shrink-0" />
          {textSummary.join(" · ")}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {(["ALL", ...LIBRARY_CATEGORIES] as const).map((c) => {
          const active = category === c
          return (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                active ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"
              )}
            >
              {c === "ALL" ? "Semua" : LIBRARY_CATEGORY_LABEL[c]}
              <span className={cn("tabular-nums", active ? "opacity-80" : "text-muted-foreground")}>
                {c === "ALL" ? rows.length : countByCategory(c)}
              </span>
            </button>
          )
        })}
      </div>

      <Card className="gap-0 overflow-hidden py-0">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-14 text-center">
            <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <FileText className="size-5" />
            </span>
            <p className="text-sm font-medium">
              {rows.length === 0 ? "Belum ada dokumen" : "Tidak ada dokumen yang cocok"}
            </p>
            <p className="max-w-sm text-xs text-muted-foreground">
              {rows.length === 0
                ? "Unggah PDF peraturan OJK, peraturan perusahaan, atau SOP agar bisa dibaca seluruh pegawai."
                : "Ubah kata kunci atau kategori pencarian."}
            </p>
          </div>
        ) : (
          <ul className="divide-y">
            {filtered.map((row) => {
              const percent = activeEmployeeCount
                ? Math.round((row.readerCount / activeEmployeeCount) * 100)
                : 0
              return (
                <li key={row.publicId} className="grid gap-3 px-4 py-4 lg:grid-cols-[minmax(0,1fr)_12rem_auto] lg:items-center">
                  <div className="flex min-w-0 gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400">
                      <FileText className="size-5" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="break-words text-sm font-medium">{row.title}</p>
                        {row.partOfPublicId ? (
                          <Badge variant="secondary">
                            <Layers className="size-3" />
                            Bagian {row.partNumber}
                          </Badge>
                        ) : row.partCount ? (
                          <Badge variant="secondary">
                            <Layers className="size-3" />
                            Bagian 1 dari {row.partCount + 1}
                          </Badge>
                        ) : null}
                        {!row.isPublished ? <Badge variant="outline">Draf</Badge> : null}
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground/80">{LIBRARY_CATEGORY_LABEL[row.category]}</span>
                        {row.documentNumber ? ` · ${row.documentNumber}` : ""}
                        {row.effectiveDate ? ` · Berlaku ${formatDate(row.effectiveDate)}` : ""}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        PDF · {row.pageCount ? `${row.pageCount} hlm · ` : ""}
                        {formatFileSize(row.sizeBytes)} · Diperbarui {formatDate(row.updatedAt)} oleh {row.uploadedBy}
                      </p>
                      <button
                        type="button"
                        onClick={() => setTextTarget(row)}
                        title="Lihat teks yang bisa dicari & baca ulang"
                        className={cn(
                          "mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium transition-opacity hover:opacity-80",
                          LIBRARY_TEXT_STATUS_CLASS[row.textStatus]
                        )}
                      >
                        <ScanText className="size-3" />
                        {LIBRARY_TEXT_STATUS_LABEL[row.textStatus]}
                        {row.scanPageCount
                          ? row.textStatus === "TANPA_OCR"
                            ? ` · ${row.scanPageCount} hlm scan`
                            : ` · OCR ${row.ocrPageCount}/${row.scanPageCount} hlm`
                          : ""}
                      </button>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setReadersTarget(row)}
                    disabled={!row.isPublished}
                    className="grid gap-1.5 rounded-md p-1 text-left transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
                    title="Lihat siapa saja yang sudah/belum membaca"
                  >
                    <span className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Users className="size-3.5" />
                        Dibaca
                      </span>
                      <span className="font-medium tabular-nums">
                        {row.readerCount}/{activeEmployeeCount}
                      </span>
                    </span>
                    <span className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <span className="block h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
                    </span>
                  </button>

                  <div className="flex gap-1.5 lg:justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      nativeButton={false}
                      render={<a href={fileUrl(row.publicId)} target="_blank" rel="noopener noreferrer" />}
                    >
                      <Eye className="size-4" />
                      Lihat
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setFormTarget(row)}>
                      <Pencil className="size-4" />
                      Ubah
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setDeleteTarget(row)}
                      aria-label={`Hapus ${row.title}`}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      {formTarget ? (
        <LibraryFormDialog
          key={formTarget === "new" ? "new" : formTarget.publicId}
          target={formTarget}
          parentOptions={parentOptions}
          parentTitle={formTarget === "new" ? null : (parentTitle(formTarget.partOfPublicId) ?? null)}
          onClose={() => setFormTarget(null)}
        />
      ) : null}
      {deleteTarget ? <DeleteDialog row={deleteTarget} onClose={() => setDeleteTarget(null)} /> : null}
      {readersTarget ? <ReadersDialog row={readersTarget} onClose={() => setReadersTarget(null)} /> : null}
      {textTarget ? (
        <TextDialog
          row={textTarget}
          ocrReady={ocrEngineAvailable && settings.ocrEnabled}
          ocrMaxScanPages={settings.ocrMaxScanPages}
          onClose={() => setTextTarget(null)}
        />
      ) : null}
      {settingsOpen ? (
        <SettingsDialog settings={settings} ocrEngineAvailable={ocrEngineAvailable} onClose={() => setSettingsOpen(false)} />
      ) : null}
    </div>
  )
}

function LibraryFormDialog({
  target,
  parentOptions,
  parentTitle,
  onClose,
}: {
  target: LibraryAdminRow | "new"
  parentOptions: LibraryAdminRow[]
  parentTitle: string | null
  onClose: () => void
}) {
  const isNew = target === "new"
  const row = isNew ? null : target
  const editingPart = !!row?.partOfPublicId
  const [category, setCategory] = useState<LibraryCategory | "">(row?.category ?? "")
  const [isPublished, setIsPublished] = useState(row?.isPublished ?? true)
  const [notify, setNotify] = useState(isNew)
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  // Pemeriksaan file sebelum disimpan (jumlah halaman, halaman scan, batas).
  const [check, setCheck] = useState<LibraryPdfCheck | null>(null)
  const [checking, setChecking] = useState(false)
  const [ocr, setOcr] = useState(false)
  // Bagian lanjutan dari dokumen lain (hanya saat menambah).
  const [isPart, setIsPart] = useState(false)
  const [partOf, setPartOf] = useState("")
  const [partNumber, setPartNumber] = useState("2")

  function handleFile(next: File | null) {
    setError(null)
    setCheck(null)
    setOcr(false)
    if (next && next.size > MAX_SIZE) {
      setError("Ukuran file maksimal 10 MB. Kompres PDF-nya terlebih dahulu.")
      setFile(null)
      return
    }
    setFile(next)
    if (!next) return
    setChecking(true)
    const formData = new FormData()
    formData.set("file", next)
    checkLibraryPdfAction(formData)
      .then((result) => {
        if ("error" in result) {
          setError(result.error)
          setFile(null)
          return
        }
        setCheck(result.check)
        // OCR aktif bawaan bila boleh dipakai untuk file ini.
        setOcr(!result.check.ocrLockedReason)
      })
      .catch(() => setError("File gagal diperiksa. Coba lagi."))
      .finally(() => setChecking(false))
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    const asPart = isNew && isPart
    if (asPart && !partOf) return setError("Pilih dokumen Bagian 1.")
    if (!asPart && !editingPart && !category) return setError("Pilih kategori dokumen.")
    if (isNew && !file) return setError("Pilih file PDF terlebih dahulu.")
    if (checking) return setError("Tunggu pemeriksaan file selesai.")
    if (check?.rejectReason) return setError(check.rejectReason)

    const formData = new FormData(event.currentTarget)
    if (category) formData.set("category", category)
    formData.delete("file")
    if (file) formData.set("file", file)
    if (isPublished) formData.set("isPublished", "on")
    if (isPublished && notify) formData.set("notify", "on")
    if (ocr && check && !check.ocrLockedReason) formData.set("ocr", "on")
    if (asPart) {
      formData.set("partOf", partOf)
      formData.set("partNumber", partNumber)
    }

    startTransition(async () => {
      const result = isNew
        ? await createLibraryDocumentAction(undefined, formData)
        : await updateLibraryDocumentAction(row!.publicId, undefined, formData)
      if (result?.error) {
        setError(result.error)
        return
      }
      toast.success(isNew ? "Dokumen ditambahkan ke Perpustakaan." : "Perubahan dokumen disimpan.")
      onClose()
    })
  }

  // Bagian lanjutan mengikuti keterangan Bagian 1 → kolom keterangan disembunyikan.
  const metaFollowsParent = editingPart || (isNew && isPart)
  const parentItems = parentOptions.map((p) => ({ value: p.publicId, label: p.title }))

  return (
    <Dialog open onOpenChange={(open) => !open && !isPending && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {isNew ? "Tambah Dokumen" : editingPart ? `Ubah Bagian ${row!.partNumber}` : "Ubah Dokumen"}
          </DialogTitle>
          <DialogDescription>
            {isNew
              ? "Dokumen PDF yang diterbitkan bisa dibaca dan dicari isinya oleh seluruh pegawai di menu Perpustakaan."
              : editingPart
                ? `Bagian dari "${parentTitle ?? "dokumen utama"}". Judul, kategori, dan status terbit mengikuti Bagian 1.`
                : "Perbarui keterangan dokumen, atau unggah file baru untuk menggantikan versi lama."}
          </DialogDescription>
        </DialogHeader>

        <form id="library-form" onSubmit={handleSubmit} className="grid gap-4">
          {isNew && parentOptions.length ? (
            <div className="grid gap-3 rounded-md border bg-muted/30 p-3">
              <label className="flex items-start justify-between gap-3 text-sm">
                <span>
                  <span className="font-medium">Bagian lanjutan dari dokumen lain</span>
                  <span className="block text-xs text-muted-foreground">
                    Untuk dokumen besar yang dipecah. Pegawai melihat semua bagian sebagai satu dokumen.
                  </span>
                </span>
                <Switch checked={isPart} onCheckedChange={(v) => setIsPart(v === true)} />
              </label>
              {isPart ? (
                <div className="grid gap-3 sm:grid-cols-[1fr_7rem]">
                  <div className="grid gap-1.5">
                    <Label>Dokumen Bagian 1</Label>
                    <Select value={partOf} onValueChange={(v) => setPartOf((v as string) ?? "")} items={parentItems}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Pilih dokumen" />
                      </SelectTrigger>
                      <SelectContent>
                        {parentItems.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="partNumber">Bagian ke</Label>
                    <Input
                      id="partNumber"
                      type="number"
                      min={2}
                      max={50}
                      value={partNumber}
                      onChange={(e) => setPartNumber(e.target.value)}
                    />
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {metaFollowsParent ? null : (
            <>
              <div className="grid gap-2">
                <Label htmlFor="title">Judul Dokumen</Label>
                <Input
                  id="title"
                  name="title"
                  defaultValue={row?.title}
                  required
                  maxLength={500}
                  placeholder="mis. Penerapan Manajemen Risiko bagi BPR"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Kategori</Label>
                  <Select
                    value={category}
                    onValueChange={(v) => setCategory((v ?? "") as LibraryCategory | "")}
                    items={CATEGORY_ITEMS}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Pilih kategori" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORY_ITEMS.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {category ? <p className="text-xs text-muted-foreground">{LIBRARY_CATEGORY_HINT[category]}</p> : null}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="documentNumber">
                    Nomor Dokumen <span className="font-normal text-muted-foreground">(opsional)</span>
                  </Label>
                  <Input
                    id="documentNumber"
                    name="documentNumber"
                    defaultValue={row?.documentNumber ?? ""}
                    maxLength={120}
                    placeholder="mis. POJK 9/POJK.03/2024"
                  />
                </div>
              </div>

              <div className="grid gap-2 sm:w-1/2 sm:pr-2">
                <Label htmlFor="effectiveDate">
                  Tanggal Berlaku <span className="font-normal text-muted-foreground">(opsional)</span>
                </Label>
                <Input id="effectiveDate" name="effectiveDate" type="date" defaultValue={row?.effectiveDate ?? ""} />
              </div>
            </>
          )}

          <div className="grid gap-2">
            <Label htmlFor="description">
              Ringkasan <span className="font-normal text-muted-foreground">(opsional)</span>
            </Label>
            <Textarea
              id="description"
              name="description"
              defaultValue={row?.description ?? ""}
              maxLength={2000}
              rows={3}
              placeholder={metaFollowsParent ? "mis. Lampiran II–IV" : "Pokok isi dokumen atau siapa yang wajib membacanya"}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="file">{isNew ? "File PDF" : "Ganti File PDF"}</Label>
            <label
              htmlFor="file"
              className="flex cursor-pointer items-center gap-3 rounded-md border border-dashed px-3 py-3 text-sm transition-colors hover:bg-muted/60"
            >
              <Upload className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">
                {file ? (
                  <>
                    {file.name} <span className="text-muted-foreground">({formatFileSize(file.size)})</span>
                  </>
                ) : isNew ? (
                  <span className="text-muted-foreground">Pilih PDF, maksimal 10 MB</span>
                ) : (
                  <span className="text-muted-foreground">
                    Saat ini: {row!.originalName}. Pilih PDF baru bila ingin mengganti.
                  </span>
                )}
              </span>
            </label>
            <input
              id="file"
              type="file"
              accept="application/pdf,.pdf"
              className="sr-only"
              onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
            />
            {!isNew && file ? (
              <p className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
                <AlertTriangle className="mt-px size-3.5 shrink-0" />
                File lama ({row!.originalName}) akan dihapus permanen setelah perubahan disimpan.
              </p>
            ) : null}
            {checking ? (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" />
                Memeriksa isi PDF…
              </p>
            ) : check ? (
              <PdfCheckPanel check={check} ocr={ocr} onOcrChange={setOcr} />
            ) : null}
          </div>

          {metaFollowsParent ? null : (
            <div className="grid gap-3 rounded-md border bg-muted/30 p-3">
              <label className="flex items-start gap-2.5 text-sm">
                <Checkbox checked={isPublished} onCheckedChange={(v) => setIsPublished(v === true)} className="mt-0.5" />
                <span>
                  <span className="font-medium">Terbitkan</span>
                  <span className="block text-xs text-muted-foreground">
                    Kalau tidak dicentang, dokumen tersimpan sebagai draf dan hanya terlihat oleh pengelola.
                  </span>
                </span>
              </label>
              <label className={cn("flex items-start gap-2.5 text-sm", !isPublished && "opacity-50")}>
                <Checkbox
                  checked={isPublished && notify}
                  disabled={!isPublished}
                  onCheckedChange={(v) => setNotify(v === true)}
                  className="mt-0.5"
                />
                <span>
                  <span className="font-medium">Kirim notifikasi ke semua pegawai</span>
                  <span className="block text-xs text-muted-foreground">
                    {isNew
                      ? "Pegawai aktif menerima pemberitahuan dokumen baru."
                      : "Centang bila perubahannya penting dan pegawai perlu membaca ulang."}
                  </span>
                </span>
              </label>
            </div>
          )}

          {error ? <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Batal
          </Button>
          <Button type="submit" form="library-form" disabled={isPending || checking || !!check?.rejectReason}>
            {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            {isNew ? "Simpan Dokumen" : "Simpan Perubahan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Ringkasan hasil pemeriksaan file + toggle OCR (PRD bagian 4.3 & 4.6).
function PdfCheckPanel({
  check,
  ocr,
  onOcrChange,
}: {
  check: LibraryPdfCheck
  ocr: boolean
  onOcrChange: (value: boolean) => void
}) {
  if (check.rejectReason) {
    return (
      <p className="flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
        <AlertTriangle className="mt-px size-3.5 shrink-0" />
        {check.rejectReason}
      </p>
    )
  }
  const locked = !!check.ocrLockedReason
  return (
    <div className="grid gap-2 rounded-md border px-3 py-2.5 text-xs">
      <p className="font-medium text-foreground">{check.summary}</p>
      {check.scanPageCount > 0 ? (
        <>
          <label className={cn("flex items-start justify-between gap-3", locked && "opacity-60")}>
            <span>
              <span className="text-sm font-medium text-foreground">Baca teks hasil scan (OCR)</span>
              <span className="block text-muted-foreground">
                OCR membaca teks dari halaman hasil scan agar isinya bisa dicari. Prosesnya{" "}
                <strong>memberatkan server</strong> (±2–6 detik per halaman), jadi matikan bila isi dokumen tidak perlu
                dicari, mis. lampiran formulir atau gambar.
              </span>
            </span>
            <Switch checked={ocr && !locked} disabled={locked} onCheckedChange={(v) => onOcrChange(v === true)} />
          </label>
          {locked ? (
            <p className="flex items-start gap-1.5 text-amber-700 dark:text-amber-400">
              <AlertTriangle className="mt-px size-3.5 shrink-0" />
              <span>
                {check.ocrLockedReason}{" "}
                {check.split ? (
                  <>
                    Agar isinya bisa dicari, pecah menjadi <strong>{check.split.parts} bagian</strong> (
                    {check.split.ranges.map(([a, b]) => `hal. ${a}–${b}`).join(", ")}) lalu unggah sebagai Bagian 1, 2,
                    dan seterusnya, atau simpan ulang hasil scan sebagai <strong>PDF yang bisa dicari</strong> dari aplikasi
                    scanner. Dokumen tetap bisa disimpan tanpa OCR: bisa dibaca dan dicari judulnya, tetapi isi halaman
                    scan tidak ikut dicari.
                  </>
                ) : (
                  "Dokumen tetap bisa disimpan; isi halaman scan belum ikut dicari."
                )}
              </span>
            </p>
          ) : !ocr ? (
            <p className="text-muted-foreground">Disimpan tanpa OCR — isi halaman scan tidak ikut dicari.</p>
          ) : null}
        </>
      ) : null}
    </div>
  )
}

function DeleteDialog({ row, onClose }: { row: LibraryAdminRow; onClose: () => void }) {
  const [isPending, startTransition] = useTransition()

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteLibraryDocumentAction(row.publicId)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success("Dokumen dihapus dari Perpustakaan.")
      onClose()
    })
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !isPending && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Hapus dokumen?</DialogTitle>
          <DialogDescription>Tindakan ini tidak bisa dibatalkan.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 text-sm">
          <div className="rounded-md border px-3 py-2.5">
            <p className="font-medium">{row.title}</p>
            <p className="text-xs text-muted-foreground">
              {LIBRARY_CATEGORY_LABEL[row.category]} · {row.originalName}
            </p>
          </div>
          <p className="flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2 text-destructive">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>
              File PDF dihapus permanen dari server, beserta catatan {row.readerCount} pegawai yang sudah
              membacanya{row.partCount ? `, dan ${row.partCount} bagian lanjutannya ikut terhapus` : ""}. Kalau hanya
              ingin menyembunyikan, ubah dokumen menjadi draf.
            </span>
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Batal
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={isPending}>
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
            Hapus Permanen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ReadersDialog({ row, onClose }: { row: LibraryAdminRow; onClose: () => void }) {
  const [readers, setReaders] = useState<LibraryReader[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState("")

  useEffect(() => {
    let cancelled = false
    getLibraryReadersAction(row.publicId).then((result) => {
      if (cancelled) return
      if ("error" in result) setError(result.error)
      else setReaders(result.readers)
    })
    return () => {
      cancelled = true
    }
  }, [row.publicId])

  const q = query.trim().toLowerCase()
  const visible = (readers ?? []).filter(
    (r) => !q || r.name.toLowerCase().includes(q) || (r.department ?? "").toLowerCase().includes(q)
  )
  const read = visible.filter((r) => r.readAt)
  const unread = visible.filter((r) => !r.readAt)

  function list(items: LibraryReader[], empty: string) {
    if (items.length === 0) {
      return <p className="py-8 text-center text-sm text-muted-foreground">{empty}</p>
    }
    return (
      <ul className="max-h-80 divide-y overflow-y-auto rounded-md border">
        {items.map((r) => (
          <li key={r.employeeNumber} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
            <span className="min-w-0">
              <span className="block truncate font-medium">{r.name}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {r.employeeNumber}
                {r.department ? ` · ${r.department}` : ""}
              </span>
            </span>
            {r.readAt ? (
              <span className="shrink-0 text-right text-xs text-muted-foreground">
                {new Date(r.readAt).toLocaleString("id-ID", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
                {r.readCount > 1 ? <span className="block">dibuka {r.readCount}×</span> : null}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    )
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Status Baca</DialogTitle>
          <DialogDescription className="line-clamp-2">{row.title}</DialogDescription>
        </DialogHeader>
        {error ? (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
        ) : !readers ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Memuat data pembaca…
          </div>
        ) : (
          <div className="grid gap-3">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cari nama atau bagian"
                className="pl-8"
              />
            </div>
            <Tabs defaultValue="unread">
              <TabsList className="w-full">
                <TabsTrigger value="unread">Belum Membaca ({unread.length})</TabsTrigger>
                <TabsTrigger value="read">Sudah Membaca ({read.length})</TabsTrigger>
              </TabsList>
              <TabsPanel value="unread" className="mt-3">
                {list(unread, "Semua pegawai sudah membaca dokumen ini.")}
              </TabsPanel>
              <TabsPanel value="read" className="mt-3">
                {list(read, "Belum ada pegawai yang membaca dokumen ini.")}
              </TabsPanel>
            </Tabs>
            <p className="text-xs text-muted-foreground">
              Tercatat saat pegawai membuka dokumen dari menu Perpustakaan.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

// Teks per halaman yang tersimpan (dipakai pencarian) + tombol Baca Ulang.
const LOW_CONFIDENCE = 60

function TextDialog({
  row,
  ocrReady,
  ocrMaxScanPages,
  onClose,
}: {
  row: LibraryAdminRow
  ocrReady: boolean
  ocrMaxScanPages: number
  onClose: () => void
}) {
  const [pages, setPages] = useState<LibraryPageText[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [index, setIndex] = useState(0)
  const [reloadKey, setReloadKey] = useState(0)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    let cancelled = false
    getLibraryPagesAction(row.publicId).then((result) => {
      if (cancelled) return
      if ("error" in result) setError(result.error)
      else setPages(result.pages)
    })
    return () => {
      cancelled = true
    }
  }, [row.publicId, reloadKey])

  function reread() {
    startTransition(async () => {
      const result = await rereadLibraryTextAction(row.publicId)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success("Teks dokumen dibaca ulang.")
      setPages(null)
      setIndex(0)
      setReloadKey((k) => k + 1)
    })
  }

  const current = pages?.[index] ?? null
  const searchable = pages?.filter((p) => p.source !== "NONE").length ?? 0
  const pendingScan = pages?.filter((p) => p.source === "NONE").length ?? 0
  const lowConfidence = pages?.filter((p) => p.source === "OCR" && p.confidence !== null && p.confidence < LOW_CONFIDENCE) ?? []
  const canRunOcr =
    ocrReady &&
    pendingScan > 0 &&
    pendingScan <= ocrMaxScanPages &&
    (row.textStatus === "TANPA_OCR" || row.textStatus === "SEBAGIAN")

  function runOcr() {
    startTransition(async () => {
      const result = await runLibraryOcrAction(row.publicId)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success(result.message ?? "OCR dijalankan.")
      onClose()
    })
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !isPending && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Teks Dokumen</DialogTitle>
          <DialogDescription className="line-clamp-2">{row.title}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className={cn("rounded-full px-2 py-0.5 font-medium", LIBRARY_TEXT_STATUS_CLASS[row.textStatus])}>
            {LIBRARY_TEXT_STATUS_LABEL[row.textStatus]}
          </span>
          {pages ? (
            <span className="text-muted-foreground">
              {searchable} dari {pages.length} halaman bisa dicari
              {pendingScan ? ` · ${pendingScan} halaman scan belum dibaca` : ""}
            </span>
          ) : null}
        </div>
        {row.textError ? (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">{row.textError}</p>
        ) : null}
        {lowConfidence.length ? (
          <p className="flex items-start gap-1.5 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
            <AlertTriangle className="mt-px size-3.5 shrink-0" />
            <span>
              Hasil OCR kurang jelas (keyakinan &lt; {LOW_CONFIDENCE}%) di halaman{" "}
              {lowConfidence
                .slice(0, 15)
                .map((p) => p.page)
                .join(", ")}
              {lowConfidence.length > 15 ? ` dan ${lowConfidence.length - 15} lainnya` : ""}. Pertimbangkan mengganti file
              dengan scan yang lebih jelas (300 dpi, tidak miring).
            </span>
          </p>
        ) : null}
        {row.textStatus === "TANPA_OCR" && pendingScan > 0 && !canRunOcr ? (
          <p className="text-xs text-muted-foreground">
            {!ocrReady
              ? "OCR belum bisa dijalankan: mesin OCR belum terpasang atau sedang dinonaktifkan Super Admin."
              : pendingScan > ocrMaxScanPages
                ? `Halaman scan melebihi batas OCR (${ocrMaxScanPages}). Pecah file menjadi beberapa bagian agar isinya bisa dicari.`
                : null}
          </p>
        ) : null}

        {error ? (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
        ) : !pages ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Memuat teks…
          </div>
        ) : pages.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Teks belum dibaca. Klik <strong>Baca Ulang</strong> untuk membaca sekarang.
          </p>
        ) : (
          <div className="grid gap-2">
            <div className="flex items-center justify-between gap-2">
              <Button variant="outline" size="sm" disabled={index === 0} onClick={() => setIndex((i) => i - 1)}>
                <ChevronLeft className="size-4" />
              </Button>
              <span className="text-xs text-muted-foreground">
                Halaman {current!.page} dari {pages.length} ·{" "}
                {current!.source === "TEXT_LAYER"
                  ? "teks PDF digital"
                  : current!.source === "OCR"
                    ? `hasil OCR${current!.confidence !== null ? ` (keyakinan ${Math.round(current!.confidence)}%)` : ""}`
                    : "halaman scan (tanpa teks)"}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={index >= pages.length - 1}
                onClick={() => setIndex((i) => i + 1)}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
            <div className="max-h-80 overflow-y-auto whitespace-pre-wrap rounded-md border bg-muted/30 p-3 text-xs leading-5">
              {current!.text || (
                <span className="text-muted-foreground">
                  Halaman ini tidak memiliki teks (kemungkinan hasil scan), sehingga isinya tidak ikut dicari.
                </span>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Tutup
          </Button>
          {canRunOcr ? (
            <Button variant="outline" onClick={runOcr} disabled={isPending}>
              <ScanText className="size-4" />
              Jalankan OCR ({pendingScan} hlm)
            </Button>
          ) : null}
          <Button onClick={reread} disabled={isPending}>
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            Baca Ulang
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Pengaturan Perpustakaan — hanya Super Admin (PRD bagian 4.4).
function SettingsDialog({
  settings,
  ocrEngineAvailable,
  onClose,
}: {
  settings: LibrarySettingsValues
  ocrEngineAvailable: boolean
  onClose: () => void
}) {
  const [ocrEnabled, setOcrEnabled] = useState(settings.ocrEnabled)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    const formData = new FormData(event.currentTarget)
    if (ocrEnabled) formData.set("ocrEnabled", "on")
    startTransition(async () => {
      const result = await updateLibrarySettingsAction(formData)
      if (result.error) {
        setError(result.error)
        return
      }
      toast.success("Pengaturan Perpustakaan disimpan.")
      onClose()
    })
  }

  const numberField = (
    name: keyof typeof LIBRARY_SETTINGS_LIMITS,
    label: string,
    hint: string,
    suffix: string
  ) => {
    const [min, max] = LIBRARY_SETTINGS_LIMITS[name]
    return (
      <div className="grid gap-1.5">
        <Label htmlFor={name}>{label}</Label>
        <div className="flex items-center gap-2">
          <Input id={name} name={name} type="number" min={min} max={max} defaultValue={settings[name]} required className="w-28" />
          <span className="text-xs text-muted-foreground">{suffix}</span>
        </div>
        <p className="text-xs text-muted-foreground">
          {hint} ({min}–{max})
        </p>
      </div>
    )
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !isPending && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Pengaturan Perpustakaan</DialogTitle>
          <DialogDescription>
            Batas pembacaan teks & OCR, dihitung dari jumlah halaman <strong>scan</strong> (yang perlu OCR). Halaman PDF
            digital tidak membebani server.
          </DialogDescription>
        </DialogHeader>

        <form id="library-settings-form" onSubmit={handleSubmit} className="grid gap-4">
          <label className="flex items-start justify-between gap-3 rounded-md border bg-muted/30 p-3 text-sm">
            <span>
              <span className="font-medium">OCR aktif</span>
              <span className="block text-xs text-muted-foreground">
                Jika dimatikan, halaman scan tidak diproses sama sekali dan toggle OCR di form unggah terkunci.
                {!ocrEngineAvailable ? " Mesin OCR (Tesseract) belum terpasang di server — tersedia di tahap berikutnya." : ""}
              </span>
            </span>
            <Switch checked={ocrEnabled} onCheckedChange={(v) => setOcrEnabled(v === true)} />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            {numberField("ocrDirectMaxPages", "OCR langsung (kecil)", "Diproses langsung, juga di jam kerja", "halaman scan")}
            {numberField("ocrQueueMaxPages", "OCR langsung bila antrean kosong", "Di atas ini dijadwalkan jam malam", "halaman scan")}
            {numberField("ocrMaxScanPages", "Maksimal halaman scan", "Di atas ini tidak bisa di-OCR, disarankan dipecah", "halaman scan")}
            {numberField("maxTotalPages", "Maksimal total halaman", "Di atas ini unggahan ditolak", "halaman")}
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="grid gap-1.5">
              <Label htmlFor="nightStart">Jam malam mulai</Label>
              <Input id="nightStart" name="nightStart" type="time" defaultValue={settings.nightStart} required />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="nightEnd">Jam malam selesai</Label>
              <Input id="nightEnd" name="nightEnd" type="time" defaultValue={settings.nightEnd} required />
            </div>
            {numberField("ocrPageTimeoutSec", "Batas waktu", "Per halaman OCR", "detik")}
          </div>

          {error ? <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Batal
          </Button>
          <Button type="submit" form="library-settings-form" disabled={isPending}>
            {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            Simpan Pengaturan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
