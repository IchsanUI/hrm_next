"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import type { LibraryCategory } from "@prisma/client"
import {
  AlertTriangle,
  Eye,
  FileText,
  Loader2,
  Pencil,
  Plus,
  Search,
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
  createLibraryDocumentAction,
  deleteLibraryDocumentAction,
  getLibraryReadersAction,
  updateLibraryDocumentAction,
  type LibraryReader,
} from "@/server/actions/library"
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
}: {
  rows: LibraryAdminRow[]
  activeEmployeeCount: number
}) {
  const [query, setQuery] = useState("")
  const [category, setCategory] = useState<LibraryCategory | "ALL">("ALL")
  const [formTarget, setFormTarget] = useState<LibraryAdminRow | "new" | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<LibraryAdminRow | null>(null)
  const [readersTarget, setReadersTarget] = useState<LibraryAdminRow | null>(null)

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
        <Button onClick={() => setFormTarget("new")}>
          <Plus className="size-4" />
          Tambah Dokumen
        </Button>
      </div>

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
          onClose={() => setFormTarget(null)}
        />
      ) : null}
      {deleteTarget ? <DeleteDialog row={deleteTarget} onClose={() => setDeleteTarget(null)} /> : null}
      {readersTarget ? <ReadersDialog row={readersTarget} onClose={() => setReadersTarget(null)} /> : null}
    </div>
  )
}

function LibraryFormDialog({ target, onClose }: { target: LibraryAdminRow | "new"; onClose: () => void }) {
  const isNew = target === "new"
  const row = isNew ? null : target
  const [category, setCategory] = useState<LibraryCategory | "">(row?.category ?? "")
  const [isPublished, setIsPublished] = useState(row?.isPublished ?? true)
  const [notify, setNotify] = useState(isNew)
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleFile(next: File | null) {
    setError(null)
    if (next && next.size > MAX_SIZE) {
      setError("Ukuran file maksimal 10 MB. Kompres PDF-nya terlebih dahulu.")
      setFile(null)
      return
    }
    setFile(next)
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    if (!category) return setError("Pilih kategori dokumen.")
    if (isNew && !file) return setError("Pilih file PDF terlebih dahulu.")

    const formData = new FormData(event.currentTarget)
    formData.set("category", category)
    formData.delete("file")
    if (file) formData.set("file", file)
    if (isPublished) formData.set("isPublished", "on")
    if (isPublished && notify) formData.set("notify", "on")

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

  return (
    <Dialog open onOpenChange={(open) => !open && !isPending && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{isNew ? "Tambah Dokumen" : "Ubah Dokumen"}</DialogTitle>
          <DialogDescription>
            {isNew
              ? "Dokumen PDF yang diterbitkan bisa dibaca seluruh pegawai di menu Perpustakaan."
              : "Perbarui keterangan dokumen, atau unggah file baru untuk menggantikan versi lama."}
          </DialogDescription>
        </DialogHeader>

        <form id="library-form" onSubmit={handleSubmit} className="grid gap-4">
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
              {category ? (
                <p className="text-xs text-muted-foreground">{LIBRARY_CATEGORY_HINT[category]}</p>
              ) : null}
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
              placeholder="Pokok isi dokumen atau siapa yang wajib membacanya"
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
          </div>

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

          {error ? (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
          ) : null}
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Batal
          </Button>
          <Button type="submit" form="library-form" disabled={isPending}>
            {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            {isNew ? "Simpan Dokumen" : "Simpan Perubahan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
              membacanya. Kalau hanya ingin menyembunyikan, ubah dokumen menjadi draf.
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
