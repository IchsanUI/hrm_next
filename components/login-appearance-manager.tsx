"use client"

import { useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { ArrowDown, ArrowUp, Crosshair, ImagePlus, Loader2, Monitor, Plus, Save, Smartphone, Trash2, X } from "lucide-react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import {
  LOGIN_SLIDE_SECONDS,
  LOGIN_TAGLINE_LIMITS,
  LOGIN_WALLPAPER_MAX_BYTES,
  LOGIN_WALLPAPER_MAX_COUNT,
  focusToPosition,
  isUploadedWallpaper,
  type LoginWallpaperView,
} from "@/lib/login-appearance-shared"
import {
  deleteLoginWallpaperAction,
  moveLoginWallpaperAction,
  updateLoginSettingsAction,
  updateLoginWallpaperAction,
  uploadLoginWallpaperAction,
} from "@/server/actions/login-appearance"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
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

export function LoginAppearanceManager({
  wallpapers,
  slideSeconds,
  taglineWords,
}: {
  wallpapers: LoginWallpaperView[]
  slideSeconds: number
  taglineWords: string[]
}) {
  const activeCount = wallpapers.filter((w) => w.isActive).length
  return (
    <div className="grid gap-6">
      <SettingsCard slideSeconds={slideSeconds} taglineWords={taglineWords} />

      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold">Gambar Login</h2>
          <p className="text-sm text-muted-foreground">
            {activeCount} dari {wallpapers.length} gambar aktif · tampil bergantian sesuai urutan. Klik gambar untuk
            mengatur titik fokus potongan.
          </p>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {wallpapers.map((w, i) => (
          <WallpaperCard
            key={w.id}
            wallpaper={w}
            isFirst={i === 0}
            isLast={i === wallpapers.length - 1}
            isOnlyActive={w.isActive && activeCount === 1}
          />
        ))}
        {wallpapers.length < LOGIN_WALLPAPER_MAX_COUNT ? <UploadCard /> : null}
      </div>
    </div>
  )
}

function SettingsCard({ slideSeconds, taglineWords }: { slideSeconds: number; taglineWords: string[] }) {
  const router = useRouter()
  const [seconds, setSeconds] = useState(String(slideSeconds))
  const [words, setWords] = useState(taglineWords)
  const [draft, setDraft] = useState("")
  const [isPending, startTransition] = useTransition()
  const dirty = Number(seconds) !== slideSeconds || words.join("|") !== taglineWords.join("|")

  function addWord() {
    const word = draft.trim().slice(0, LOGIN_TAGLINE_LIMITS.maxLength)
    if (!word || words.includes(word) || words.length >= LOGIN_TAGLINE_LIMITS.maxWords) return
    setWords([...words, word])
    setDraft("")
  }

  function save() {
    startTransition(async () => {
      const result = await updateLoginSettingsAction({ slideSeconds: Number(seconds), taglineWords: words })
      if (result.error) return void toast.error(result.error)
      toast.success("Pengaturan tampilan login disimpan.")
      router.refresh()
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Slideshow & Tagline</CardTitle>
        <CardDescription>
          Tagline tampil di bawah gambar (desktop): <em>Kelola</em> <strong>{words[0] ?? "…"}</strong> <em>dalam satu platform.</em>{" "}
          — kata tebal berganti otomatis.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5">
        <div className="grid gap-1.5 sm:max-w-xs">
          <Label htmlFor="slideSeconds">Durasi tiap gambar</Label>
          <div className="flex items-center gap-2">
            <Input
              id="slideSeconds"
              type="number"
              min={LOGIN_SLIDE_SECONDS.min}
              max={LOGIN_SLIDE_SECONDS.max}
              value={seconds}
              onChange={(e) => setSeconds(e.target.value)}
              className="w-24"
            />
            <span className="text-sm text-muted-foreground">detik</span>
          </div>
          <p className="text-xs text-muted-foreground">
            {LOGIN_SLIDE_SECONDS.min}–{LOGIN_SLIDE_SECONDS.max} detik. Tidak berpengaruh bila hanya satu gambar aktif.
          </p>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="taglineWord">Kata tagline yang berganti</Label>
          <div className="flex flex-wrap gap-1.5">
            {words.map((w) => (
              <span key={w} className="inline-flex items-center gap-1 rounded-full border bg-muted/50 py-0.5 pr-1 pl-2.5 text-sm">
                {w}
                <button
                  type="button"
                  onClick={() => setWords(words.filter((x) => x !== w))}
                  className="rounded-full p-0.5 text-muted-foreground hover:bg-background hover:text-foreground"
                  aria-label={`Hapus ${w}`}
                >
                  <X className="size-3.5" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2 sm:max-w-md">
            <Input
              id="taglineWord"
              value={draft}
              maxLength={LOGIN_TAGLINE_LIMITS.maxLength}
              placeholder="mis. Kendaraan Dinas"
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  addWord()
                }
              }}
            />
            <Button
              type="button"
              variant="outline"
              onClick={addWord}
              disabled={!draft.trim() || words.length >= LOGIN_TAGLINE_LIMITS.maxWords}
            >
              <Plus className="size-4" />
              Tambah
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Maksimal {LOGIN_TAGLINE_LIMITS.maxWords} kata/frasa, masing-masing {LOGIN_TAGLINE_LIMITS.maxLength} karakter.
          </p>
        </div>

        <div>
          <Button onClick={save} disabled={!dirty || isPending || words.length === 0}>
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Simpan
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function WallpaperCard({
  wallpaper,
  isFirst,
  isLast,
  isOnlyActive,
}: {
  wallpaper: LoginWallpaperView
  isFirst: boolean
  isLast: boolean
  isOnlyActive: boolean
}) {
  const router = useRouter()
  const [label, setLabel] = useState(wallpaper.label ?? "")
  const [focus, setFocus] = useState({ x: wallpaper.focusX, y: wallpaper.focusY })
  const [isActive, setIsActive] = useState(wallpaper.isActive)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [isPending, startTransition] = useTransition()
  const dirty =
    label !== (wallpaper.label ?? "") ||
    focus.x !== wallpaper.focusX ||
    focus.y !== wallpaper.focusY ||
    isActive !== wallpaper.isActive
  const position = focusToPosition(focus.x, focus.y)

  function run(fn: () => Promise<{ error?: string }>, message: string) {
    startTransition(async () => {
      const result = await fn()
      if (result.error) return void toast.error(result.error)
      toast.success(message)
      router.refresh()
    })
  }

  function pickFocus(event: React.MouseEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect()
    const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)))
    setFocus({
      x: clamp(((event.clientX - rect.left) / rect.width) * 100),
      y: clamp(((event.clientY - rect.top) / rect.height) * 100),
    })
  }

  return (
    <Card className={cn("gap-0 overflow-hidden py-0", !isActive && "opacity-75")}>
      <div className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto]">
        {/* Gambar utuh — klik untuk memilih titik fokus. */}
        <div
          role="button"
          tabIndex={0}
          aria-label="Klik untuk mengatur titik fokus"
          onClick={pickFocus}
          className="relative cursor-crosshair overflow-hidden rounded-md bg-muted"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={wallpaper.imageUrl} alt={label || "Gambar login"} className="block h-auto w-full select-none" draggable={false} />
          <span
            className="pointer-events-none absolute flex size-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-primary/70 text-white shadow-lg"
            style={{ left: `${focus.x}%`, top: `${focus.y}%` }}
          >
            <Crosshair className="size-4" />
          </span>
          <span className="pointer-events-none absolute top-2 left-2 flex gap-1">
            {isUploadedWallpaper(wallpaper.imageUrl) ? null : <Badge variant="secondary">Bawaan</Badge>}
            {!isActive ? <Badge variant="outline" className="bg-background/80">Nonaktif</Badge> : null}
          </span>
        </div>

        {/* Pratinjau potongan sesuai bentuk panel login. */}
        <div className="flex gap-3 sm:flex-col">
          <figure className="grid gap-1">
            <div className="relative h-32 w-24 overflow-hidden rounded-md border bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={wallpaper.imageUrl} alt="" className="size-full object-cover" style={{ objectPosition: position }} />
            </div>
            <figcaption className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Monitor className="size-3" /> Desktop
            </figcaption>
          </figure>
          <figure className="grid gap-1">
            <div className="relative h-12 w-24 overflow-hidden rounded-md border bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={wallpaper.imageUrl} alt="" className="size-full object-cover" style={{ objectPosition: position }} />
            </div>
            <figcaption className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Smartphone className="size-3" /> HP
            </figcaption>
          </figure>
        </div>
      </div>

      <div className="grid gap-3 border-t bg-muted/20 p-4">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <div className="grid gap-1.5">
            <Label htmlFor={`label-${wallpaper.id}`}>Nama (untuk admin)</Label>
            <Input
              id={`label-${wallpaper.id}`}
              value={label}
              maxLength={100}
              placeholder="mis. Foto tim di depan kantor"
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>
          <label className="flex h-9 items-center gap-2 text-sm">
            <Switch
              checked={isActive}
              disabled={isOnlyActive && isActive}
              onCheckedChange={(v) => setIsActive(v === true)}
            />
            Tampilkan
          </label>
        </div>
        <p className="text-xs text-muted-foreground">
          Titik fokus {focus.x}% dari kiri, {focus.y}% dari atas — bagian ini selalu terlihat saat gambar dipotong.
          {isOnlyActive ? " Ini satu-satunya gambar aktif." : ""}
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            onClick={() =>
              run(
                () => updateLoginWallpaperAction(wallpaper.id, { label: label.trim() || null, focusX: focus.x, focusY: focus.y, isActive }),
                "Gambar disimpan."
              )
            }
            disabled={!dirty || isPending}
          >
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Simpan
          </Button>
          {dirty ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setLabel(wallpaper.label ?? "")
                setFocus({ x: wallpaper.focusX, y: wallpaper.focusY })
                setIsActive(wallpaper.isActive)
              }}
            >
              Batal
            </Button>
          ) : null}
          <div className="ml-auto flex gap-1">
            <Button
              size="icon-sm"
              variant="outline"
              aria-label="Naikkan urutan"
              disabled={isFirst || isPending}
              onClick={() => run(() => moveLoginWallpaperAction(wallpaper.id, "up"), "Urutan diubah.")}
            >
              <ArrowUp className="size-4" />
            </Button>
            <Button
              size="icon-sm"
              variant="outline"
              aria-label="Turunkan urutan"
              disabled={isLast || isPending}
              onClick={() => run(() => moveLoginWallpaperAction(wallpaper.id, "down"), "Urutan diubah.")}
            >
              <ArrowDown className="size-4" />
            </Button>
            <Button
              size="icon-sm"
              variant="outline"
              className="text-destructive hover:text-destructive"
              aria-label="Hapus gambar"
              disabled={isPending || isOnlyActive}
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        </div>
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus gambar ini?</AlertDialogTitle>
            <AlertDialogDescription>
              {isUploadedWallpaper(wallpaper.imageUrl)
                ? "Gambar dihapus dari halaman login dan file-nya dihapus permanen dari server."
                : "Gambar bawaan hanya dilepas dari daftar; file aslinya tetap ada di aplikasi."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                setConfirmDelete(false)
                run(() => deleteLoginWallpaperAction(wallpaper.id), "Gambar dihapus.")
              }}
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}

function UploadCard() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [label, setLabel] = useState("")
  const [isPending, startTransition] = useTransition()

  function choose(next: File | null) {
    if (preview) URL.revokeObjectURL(preview)
    if (next && next.size > LOGIN_WALLPAPER_MAX_BYTES) {
      toast.error("Ukuran gambar maksimal 8 MB.")
      next = null
    }
    setFile(next)
    setPreview(next ? URL.createObjectURL(next) : null)
  }

  function upload() {
    if (!file) return
    const formData = new FormData()
    formData.set("file", file)
    formData.set("label", label)
    startTransition(async () => {
      const result = await uploadLoginWallpaperAction(formData)
      if (result.error) return void toast.error(result.error)
      toast.success("Gambar ditambahkan. Atur titik fokusnya bila perlu.")
      choose(null)
      setLabel("")
      if (inputRef.current) inputRef.current.value = ""
      router.refresh()
    })
  }

  return (
    <Card className="gap-0 border-dashed py-0">
      <div className="grid gap-3 p-4">
        <div>
          <p className="flex items-center gap-1.5 font-medium">
            <ImagePlus className="size-4" />
            Tambah Gambar
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            JPG, PNG, atau WebP, maks. 8 MB, lebar minimal 1000 px. Disarankan 1920 × 1080 (16:9) dengan objek utama di
            tengah. Gambar otomatis dikompres ke WebP.
          </p>
        </div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex min-h-32 items-center justify-center overflow-hidden rounded-md border border-dashed bg-muted/40 text-sm text-muted-foreground transition-colors hover:bg-muted"
        >
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Pratinjau" className="max-h-56 w-full object-contain" />
          ) : (
            "Pilih gambar…"
          )}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={(e) => choose(e.target.files?.[0] ?? null)}
        />
        <div className="grid gap-1.5">
          <Label htmlFor="new-label">Nama (opsional)</Label>
          <Input id="new-label" value={label} maxLength={100} onChange={(e) => setLabel(e.target.value)} />
        </div>
        <div>
          <Button onClick={upload} disabled={!file || isPending}>
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
            Unggah
          </Button>
        </div>
      </div>
    </Card>
  )
}
