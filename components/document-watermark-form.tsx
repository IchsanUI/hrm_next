"use client"

import { useState, useTransition, type FormEvent } from "react"
import { toast } from "sonner"

import { updateDocumentWatermarkAction } from "@/server/actions/employee-document-settings"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

export function DocumentWatermarkForm({
  enabled: initialEnabled,
  text,
}: {
  enabled: boolean
  text: string | null
}) {
  const [enabled, setEnabled] = useState(initialEnabled)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    // Switch bukan input native, nilainya tidak ikut FormData — disetel manual.
    formData.set("watermarkEnabled", enabled ? "on" : "off")
    startTransition(async () => {
      const result = await updateDocumentWatermarkAction(undefined, formData)
      if (result?.error) toast.error(result.error)
      else toast.success("Pengaturan watermark disimpan.")
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Watermark Dokumen Pribadi</CardTitle>
        <CardDescription>
          Scan KTP, Kartu Keluarga, NPWP, dan Surat Nikah/Akta Cerai diberi watermark otomatis
          setiap kali dibuka — memuat tanda RAHASIA, nama &amp; NIP pemilik dokumen, serta nama
          pembuka dan waktunya. Jejak itu membuat tangkapan layar yang beredar bisa dilacak ke
          orangnya.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Watermark Aktif</p>
              <p className="text-xs text-muted-foreground">
                {enabled
                  ? "File asli tetap tersimpan utuh — watermark hanya ditempel saat dokumen ditampilkan."
                  : "Sedang mati: dokumen identitas disajikan apa adanya, tanpa penanda maupun jejak pembuka."}
              </p>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} disabled={isPending} />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="watermarkText">Teks Tambahan (opsional)</Label>
            <Input
              id="watermarkText"
              name="watermarkText"
              defaultValue={text ?? ""}
              maxLength={120}
              placeholder="Mis. PERUMDA BPR BANK GRESIK — DILARANG DISEBARLUASKAN"
              disabled={!enabled}
            />
            <p className="text-xs text-muted-foreground">
              Dicetak sebagai baris tambahan di bawah identitas. Kosongkan kalau tidak perlu —
              tanda RAHASIA dan jejak pembuka tetap jalan. Maksimal 120 karakter supaya tidak
              menutupi isi dokumen.
            </p>
          </div>

          <div>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Menyimpan..." : "Simpan"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
