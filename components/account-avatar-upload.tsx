"use client"

import { useRef, useState, useTransition, type PointerEvent } from "react"
import { toast } from "sonner"
import { Check, ImagePlus, X } from "lucide-react"

import { updateAccountAvatarAction } from "@/server/actions/account"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent } from "@/components/ui/dialog"

// Editor crop foto profil akun (drag buat geser, slider buat zoom) — beda
// dari components/employee-image-upload.tsx yang cuma unggah mentah lalu
// server auto-crop tengah (sharp .resize(fit:"cover")). Di sini pegawai
// sendiri yang pilih bagian mana dari fotonya yang jadi avatar SEBELUM
// diunggah — hasil crop-nya (canvas, ukuran tetap persegi) yang dikirim ke
// updateAccountAvatarAction, bukan file asli.
const VIEWPORT_SIZE = 260
const OUTPUT_SIZE = 480
const MIN_ZOOM = 1
const MAX_ZOOM = 3

type Offset = { x: number; y: number }
type NaturalSize = { w: number; h: number }

function baseScale(size: NaturalSize) {
  return Math.max(VIEWPORT_SIZE / size.w, VIEWPORT_SIZE / size.h)
}

// Jaga gambar selalu menutupi penuh viewport (tidak ada celah kosong) pada
// zoom berapa pun — offset dibatasi supaya tepi gambar tidak pernah masuk
// ke dalam area viewport.
function clampOffset(next: Offset, size: NaturalSize, zoom: number): Offset {
  const scale = baseScale(size) * zoom
  const displayedW = size.w * scale
  const displayedH = size.h * scale
  const minX = VIEWPORT_SIZE - displayedW
  const minY = VIEWPORT_SIZE - displayedH
  return {
    x: Math.min(0, Math.max(minX, next.x)),
    y: Math.min(0, Math.max(minY, next.y)),
  }
}

export function AccountAvatarUpload({ currentUrl }: { currentUrl: string | null }) {
  const [imageSrc, setImageSrc] = useState<string | null>(null)
  const [naturalSize, setNaturalSize] = useState<NaturalSize | null>(null)
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 })
  const [isPending, startTransition] = useTransition()

  const fileInputRef = useRef<HTMLInputElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const dragRef = useRef<{ startX: number; startY: number; offsetX: number; offsetY: number } | null>(null)

  function resetCropState() {
    setImageSrc(null)
    setNaturalSize(null)
    setZoom(1)
    setOffset({ x: 0, y: 0 })
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = "" // biar file yang sama bisa dipilih lagi nanti
    if (!file) return
    if (!file.type.startsWith("image/")) {
      toast.error("File harus berupa gambar.")
      return
    }
    setImageSrc(URL.createObjectURL(file))
  }

  function handleImageLoad() {
    const img = imgRef.current
    if (!img) return
    const size = { w: img.naturalWidth, h: img.naturalHeight }
    setNaturalSize(size)
    const scale = baseScale(size)
    // Pusatkan gambar di viewport begitu dimuat.
    setOffset({ x: (VIEWPORT_SIZE - size.w * scale) / 2, y: (VIEWPORT_SIZE - size.h * scale) / 2 })
  }

  function handlePointerDown(e: PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = { startX: e.clientX, startY: e.clientY, offsetX: offset.x, offsetY: offset.y }
  }

  function handlePointerMove(e: PointerEvent<HTMLDivElement>) {
    if (!dragRef.current || !naturalSize) return
    const dx = e.clientX - dragRef.current.startX
    const dy = e.clientY - dragRef.current.startY
    setOffset(
      clampOffset(
        { x: dragRef.current.offsetX + dx, y: dragRef.current.offsetY + dy },
        naturalSize,
        zoom
      )
    )
  }

  function handlePointerUp() {
    dragRef.current = null
  }

  function handleZoomChange(value: number) {
    setZoom(value)
    if (naturalSize) {
      setOffset((prev) => clampOffset(prev, naturalSize, value))
    }
  }

  function handleConfirm() {
    const img = imgRef.current
    if (!img || !naturalSize) return

    const scale = baseScale(naturalSize) * zoom
    const sourceX = -offset.x / scale
    const sourceY = -offset.y / scale
    const sourceSize = VIEWPORT_SIZE / scale

    const canvas = document.createElement("canvas")
    canvas.width = OUTPUT_SIZE
    canvas.height = OUTPUT_SIZE
    const ctx = canvas.getContext("2d")
    if (!ctx) {
      toast.error("Browser tidak mendukung pemrosesan gambar.")
      return
    }
    ctx.drawImage(img, sourceX, sourceY, sourceSize, sourceSize, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE)

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          toast.error("Gagal memproses gambar.")
          return
        }
        const file = new File([blob], "avatar.jpg", { type: "image/jpeg" })
        const formData = new FormData()
        formData.set("avatar", file)
        startTransition(async () => {
          const result = await updateAccountAvatarAction(undefined, formData)
          if (result?.error) {
            toast.error(result.error)
          } else {
            toast.success("Foto profil berhasil diunggah.")
            resetCropState()
          }
        })
      },
      "image/jpeg",
      0.9
    )
  }

  const scale = naturalSize ? baseScale(naturalSize) * zoom : 0
  const displaySize = naturalSize ? { w: naturalSize.w * scale, h: naturalSize.h * scale } : null

  return (
    <div className="flex flex-col items-center gap-3">
      {currentUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- foto akun sendiri, di-refresh via revalidatePath, tidak perlu optimisasi next/image
        <img
          src={currentUrl}
          alt="Foto Profil"
          className="size-[100px] rounded-full border object-cover"
        />
      ) : (
        <div className="flex size-[100px] items-center justify-center rounded-full border border-dashed bg-muted text-center text-xs text-muted-foreground">
          Tanpa Foto
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
      <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
        <ImagePlus className="size-3.5" />
        Ubah Foto
      </Button>

      <Dialog open={imageSrc !== null} onOpenChange={(open) => !open && resetCropState()}>
        <DialogContent
          showCloseButton={false}
          className="max-w-xs gap-0 overflow-hidden border-0 bg-neutral-950 p-0 text-white sm:max-w-xs"
        >
          <div className="flex items-center justify-between px-3 py-2.5">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="text-white hover:bg-white/10 hover:text-white"
              onClick={resetCropState}
            >
              <X className="size-4" />
            </Button>
            <p className="text-xs font-medium text-white/80">Geser untuk atur posisi</p>
            <span className="size-8" aria-hidden />
          </div>

          <div
            className="relative mx-auto touch-none overflow-hidden rounded-full bg-neutral-900"
            style={{ width: VIEWPORT_SIZE, height: VIEWPORT_SIZE }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          >
            {imageSrc ? (
              // eslint-disable-next-line @next/next/no-img-element -- object URL lokal buat crop, next/image tidak cocok
              <img
                ref={imgRef}
                src={imageSrc}
                alt="Pratinjau foto"
                draggable={false}
                onLoad={handleImageLoad}
                className="absolute top-0 left-0 max-w-none cursor-grab touch-none select-none active:cursor-grabbing"
                style={
                  displaySize
                    ? {
                        width: displaySize.w,
                        height: displaySize.h,
                        transform: `translate(${offset.x}px, ${offset.y}px)`,
                      }
                    : undefined
                }
              />
            ) : null}
          </div>

          <div className="flex items-center gap-3 px-4 py-3">
            <span className="text-xs text-white/60">Zoom</span>
            <input
              type="range"
              min={MIN_ZOOM}
              max={MAX_ZOOM}
              step={0.05}
              value={zoom}
              onChange={(e) => handleZoomChange(Number(e.target.value))}
              disabled={!naturalSize}
              className="h-1.5 flex-1 accent-emerald-500"
            />
          </div>

          <div className="flex justify-end px-3 pb-3">
            <Button
              type="button"
              onClick={handleConfirm}
              disabled={isPending || !naturalSize}
              className="rounded-full bg-emerald-500 text-white hover:bg-emerald-600"
            >
              {isPending ? (
                "Menyimpan..."
              ) : (
                <>
                  <Check className="size-4" />
                  Gunakan Foto
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
