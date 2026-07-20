"use client"

import { useEffect, useState, useTransition, type FormEvent } from "react"
import { MapPin } from "lucide-react"
import { toast } from "sonner"

import {
  createLateArrivalRequestAction,
  type LateArrivalFormState,
} from "@/server/actions/late-arrival"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { CameraCaptureInput } from "@/components/camera-capture-input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

type LocationState =
  | { status: "loading" }
  | { status: "granted"; lat: number; lng: number }
  | { status: "unavailable" }

export function LateArrivalRequestForm() {
  const [state, setState] = useState<LateArrivalFormState>(undefined)
  const [isPending, startTransition] = useTransition()
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([])
  const [location, setLocation] = useState<LocationState>({ status: "loading" })

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocation({ status: "unavailable" })
      return
    }
    navigator.geolocation.getCurrentPosition(
      (position) =>
        setLocation({
          status: "granted",
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        }),
      () => setLocation({ status: "unavailable" }),
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }, [])

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (evidenceFiles.length === 0) {
      toast.error("Foto bukti kondisi wajib diambil.")
      return
    }

    const formData = new FormData(event.currentTarget)
    formData.append("evidence", evidenceFiles[0])

    startTransition(async () => {
      const result = await createLateArrivalRequestAction(undefined, formData)
      setState(result)
      if (result?.error) toast.error(result.error)
    })
  }

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle>Form Pengajuan Izin Terlambat</CardTitle>
        <CardDescription>
          Ajukan sekarang juga kalau Anda masih dalam perjalanan dan akan
          terlambat. Setelah tiba di kantor, Anda tetap wajib konfirmasi
          kedatangan di sistem dan absen fingerprint seperti biasa.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid gap-4">
          {location.status === "granted" ? (
            <>
              <input type="hidden" name="locationLat" value={location.lat} />
              <input type="hidden" name="locationLng" value={location.lng} />
            </>
          ) : null}

          <div className="grid gap-2">
            <Label htmlFor="reason">Alasan Keterlambatan</Label>
            <Textarea
              id="reason"
              name="reason"
              placeholder="Jelaskan kondisi yang membuat Anda terlambat (mis. macet, ban bocor)"
              required
            />
          </div>

          <div className="grid gap-2">
            <Label>Foto Bukti Kondisi</Label>
            <CameraCaptureInput files={evidenceFiles} onChange={setEvidenceFiles} multiple={false} />
          </div>

          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="size-3.5" />
            {location.status === "loading" ? "Mendeteksi lokasi..." : null}
            {location.status === "granted" ? "Lokasi terdeteksi, akan disertakan sebagai informasi tambahan." : null}
            {location.status === "unavailable"
              ? "Lokasi tidak tersedia — pengajuan tetap bisa dikirim."
              : null}
          </p>

          {state?.error ? (
            <p className="text-destructive text-sm">{state.error}</p>
          ) : null}
          <div>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Mengirim..." : "Ajukan Izin Terlambat"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
