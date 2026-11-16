"use client"

import { useEffect, useRef, useState, useTransition, type ChangeEvent, type FormEvent } from "react"
import { ImagePlus, X } from "lucide-react"
import { toast } from "sonner"

import { createIssueReportAction } from "@/server/actions/issue-reports"
import { ISSUE_CATEGORIES, ISSUE_CATEGORY_LABEL, type IssueCategory } from "@/lib/issue-report-labels"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

const CATEGORY_ITEMS = ISSUE_CATEGORIES.map((value) => ({
  value,
  label: ISSUE_CATEGORY_LABEL[value],
}))

// Harus sama dengan batas di lib/issue-report-attachments.ts (server tetap
// memvalidasi ulang — ini cuma supaya pesan error muncul sebelum upload).
const MAX_IMAGES = 3
const MAX_IMAGE_BYTES = 3 * 1024 * 1024
const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp"]

type Picked = { file: File; previewUrl: string }

export function IssueReportForm() {
  const formRef = useRef<HTMLFormElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [category, setCategory] = useState<IssueCategory | "">("")
  const [images, setImages] = useState<Picked[]>([])
  const [descriptionLength, setDescriptionLength] = useState(0)
  const [isPending, startTransition] = useTransition()

  // Bebaskan object URL preview saat komponen unmount.
  const imagesRef = useRef(images)
  useEffect(() => {
    imagesRef.current = images
  }, [images])
  useEffect(() => {
    return () => imagesRef.current.forEach((i) => URL.revokeObjectURL(i.previewUrl))
  }, [])

  function handlePick(event: ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(event.target.files ?? [])
    event.target.value = "" // izinkan pilih file yang sama lagi setelah dihapus

    const next = [...images]
    for (const file of picked) {
      if (next.length >= MAX_IMAGES) {
        toast.error(`Maksimal ${MAX_IMAGES} gambar.`)
        break
      }
      if (!ACCEPTED_TYPES.includes(file.type)) {
        toast.error(`"${file.name}" bukan PNG, JPG, atau WebP.`)
        continue
      }
      if (file.size > MAX_IMAGE_BYTES) {
        toast.error(`"${file.name}" melebihi 3 MB.`)
        continue
      }
      next.push({ file, previewUrl: URL.createObjectURL(file) })
    }
    setImages(next)
  }

  function removeImage(index: number) {
    setImages((prev) => {
      URL.revokeObjectURL(prev[index].previewUrl)
      return prev.filter((_, i) => i !== index)
    })
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!category) {
      toast.error("Pilih kategori kendala.")
      return
    }
    const formData = new FormData(event.currentTarget)
    formData.set("category", category)
    images.forEach((i) => formData.append("images", i.file))

    startTransition(async () => {
      const result = await createIssueReportAction(undefined, formData)
      if (result?.error) {
        toast.error(result.error)
        return
      }
      toast.success(
        result?.ticketNumber
          ? `Laporan terkirim dengan nomor tiket ${result.ticketNumber}.`
          : "Laporan terkirim."
      )
      formRef.current?.reset()
      setCategory("")
      images.forEach((i) => URL.revokeObjectURL(i.previewUrl))
      setImages([])
      setDescriptionLength(0)
    })
  }

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Buat Laporan Baru</CardTitle>
        <CardDescription>
          Ada error, data yang keliru, atau fitur yang tidak berjalan? Ceritakan
          di sini supaya bisa kami periksa.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form ref={formRef} onSubmit={handleSubmit} className="grid gap-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Kategori</Label>
              <Select
                value={category}
                onValueChange={(value) => setCategory((value ?? "") as IssueCategory | "")}
                items={CATEGORY_ITEMS}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Pilih kategori kendala" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_ITEMS.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="title">Judul Kendala</Label>
              <Input
                id="title"
                name="title"
                maxLength={150}
                placeholder="Mis. Slip gaji tidak bisa dibuka"
                required
              />
            </div>
          </div>

          <div className="grid gap-2">
            <div className="flex items-baseline justify-between gap-2">
              <Label htmlFor="description">Deskripsi</Label>
              <span className="text-xs tabular-nums text-muted-foreground">{descriptionLength}/2000</span>
            </div>
            <Textarea
              id="description"
              name="description"
              rows={6}
              maxLength={2000}
              onChange={(e) => setDescriptionLength(e.target.value.length)}
              placeholder="Jelaskan apa yang terjadi, di halaman mana, dan langkah sebelum muncul masalah."
              required
            />
          </div>

          <div className="grid gap-2">
            <Label>
              Screenshot <span className="font-normal text-muted-foreground">(opsional)</span>
            </Label>
            <div className="flex flex-wrap gap-3">
              {images.map((image, index) => (
                <div key={image.previewUrl} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={image.previewUrl}
                    alt={`Pratinjau ${index + 1}`}
                    className="size-24 rounded-md border object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removeImage(index)}
                    aria-label={`Hapus gambar ${index + 1}`}
                    className="absolute -right-2 -top-2 flex size-6 items-center justify-center rounded-full bg-destructive text-white shadow"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ))}
              {images.length < MAX_IMAGES ? (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex size-24 flex-col items-center justify-center gap-1 rounded-md border border-dashed text-xs text-muted-foreground transition hover:bg-muted"
                >
                  <ImagePlus className="size-5" />
                  Tambah
                </button>
              ) : null}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_TYPES.join(",")}
              multiple
              className="hidden"
              onChange={handlePick}
            />
            <p className="text-xs text-muted-foreground">
              Maksimal {MAX_IMAGES} gambar (PNG, JPG, WebP), masing-masing 3 MB.
            </p>
          </div>

          <div className="flex items-center justify-between gap-3 border-t pt-4">
            <p className="text-xs text-muted-foreground">
              Anda akan mendapat nomor tiket dan notifikasi saat laporan ditanggapi.
            </p>
            <Button type="submit" disabled={isPending} className="shrink-0">
              {isPending ? "Mengirim..." : "Kirim Laporan"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
