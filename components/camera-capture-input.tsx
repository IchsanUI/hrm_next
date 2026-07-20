"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Camera, X } from "lucide-react"

import { compressImage } from "@/lib/compress-image"
import { Button } from "@/components/ui/button"

// Foto disimpan sebagai File[] di state React (bukan lewat native
// `<input>.files`) karena hasil kamera perlu DITAMBAHKAN ke daftar yang
// sudah ada, bukan menggantikannya — input native cuma nyimpen hasil pick
// terakhir. Form pemanggil (mis. OvertimeCompleteForm) yang tanggung jawab
// masukin File[] ini ke FormData secara manual saat submit.
export function CameraCaptureInput({
  files,
  onChange,
  multiple = true,
  maxFiles,
}: {
  files: File[]
  onChange: (files: File[]) => void
  // false = cuma boleh 1 foto — capture berikutnya GANTI foto yang sudah
  // ada, bukan nambah (dipakai Izin Terlambat, beda dari Bukti Lembur yang
  // boleh banyak).
  multiple?: boolean
  // Batas jumlah foto (mis. Bukti Lembur maksimal 5) — supaya body server
  // action tidak nabrak batas ukuran walau tiap foto sudah dikompres.
  maxFiles?: number
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isCompressing, setIsCompressing] = useState(false)
  // Preview URL dihitung langsung saat render (bukan state terpisah) —
  // effect di bawah cuma buat cleanup, bukan sinkronisasi state.
  const previews = useMemo(() => files.map((file) => URL.createObjectURL(file)), [files])

  useEffect(() => {
    return () => {
      previews.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [previews])

  const reachedLimit = maxFiles !== undefined && files.length >= maxFiles

  async function handleCapture(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = "" // reset supaya bisa dipicu lagi buat foto berikutnya
    if (!file) return

    setIsCompressing(true)
    const compressed = await compressImage(file)
    setIsCompressing(false)
    onChange(multiple ? [...files, compressed] : [compressed])
  }

  function removeAt(index: number) {
    onChange(files.filter((_, i) => i !== index))
  }

  return (
    <div className="grid gap-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleCapture}
      />
      <Button
        type="button"
        variant="outline"
        disabled={isCompressing || reachedLimit}
        onClick={() => inputRef.current?.click()}
      >
        <Camera className="size-4" />
        {isCompressing
          ? "Memproses foto..."
          : reachedLimit
            ? `Maksimal ${maxFiles} foto`
            : files.length === 0
              ? "Ambil Foto"
              : multiple
                ? "Tambah Foto Lagi"
                : "Ganti Foto"}
      </Button>
      {maxFiles !== undefined ? (
        <p className="text-xs text-muted-foreground">
          {files.length}/{maxFiles} foto — tiap foto otomatis dikompres.
        </p>
      ) : null}

      {previews.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {previews.map((src, index) => (
            <div key={src} className="relative size-20 shrink-0 overflow-hidden rounded-md border">
              {/* eslint-disable-next-line @next/next/no-img-element -- preview dari blob URL lokal, bukan aset next/image */}
              <img src={src} alt={`Bukti ${index + 1}`} className="size-full object-cover" />
              <button
                type="button"
                onClick={() => removeAt(index)}
                aria-label={`Hapus foto ${index + 1}`}
                className="absolute top-0.5 right-0.5 flex size-5 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
              >
                <X className="size-3" />
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
