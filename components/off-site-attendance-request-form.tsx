"use client"

import { useActionState, useEffect, useState } from "react"
import { MapPin } from "lucide-react"
import { toast } from "sonner"

import {
  createOffSiteAttendanceRequestAction,
  type OffSiteAttendanceFormState,
} from "@/server/actions/off-site-attendance"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

type LocationState =
  | { status: "loading" }
  | { status: "granted"; lat: number; lng: number }
  | { status: "unavailable" }

function todayDateValue() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
}

export function OffSiteAttendanceRequestForm({
  disabledReason,
}: {
  disabledReason?: string | null
}) {
  const [state, formAction, isPending] = useActionState<OffSiteAttendanceFormState, FormData>(
    createOffSiteAttendanceRequestAction,
    undefined
  )
  const [location, setLocation] = useState<LocationState>({ status: "loading" })

  useEffect(() => {
    if (state?.error) toast.error(state.error)
  }, [state])

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

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle>Form Pengajuan Izin Absen Diluar Kantor</CardTitle>
        <CardDescription>
          Isi kalau Anda sedang/akan dinas atau bekerja di luar kantor
          sehingga tidak bisa absen fingerprint di kantor. Pengajuan akan
          dikirim ke atasan langsung untuk disetujui.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {disabledReason ? (
          <p className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {disabledReason}
          </p>
        ) : null}
        <form action={formAction} className="grid gap-4">
          <fieldset disabled={!!disabledReason} className="grid gap-4">
            {location.status === "granted" ? (
              <>
                <input type="hidden" name="locationLat" value={location.lat} />
                <input type="hidden" name="locationLng" value={location.lng} />
              </>
            ) : null}

            <div className="grid gap-2">
              <Label htmlFor="date">Tanggal</Label>
              <Input id="date" name="date" type="date" defaultValue={todayDateValue()} required />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="location">Lokasi Kerja di Luar Kantor</Label>
              <Input
                id="location"
                name="location"
                placeholder="mis. Kantor Cabang Bungah / Rumah Nasabah Bpk. Ahmad"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="reason">Keperluan</Label>
              <Textarea
                id="reason"
                name="reason"
                placeholder="Jelaskan keperluan Anda bekerja di luar kantor"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="evidence">Bukti Pendukung</Label>
              <Input id="evidence" name="evidence" type="file" accept="image/*,.pdf" required />
              <p className="text-xs text-muted-foreground">
                Wajib — mis. surat tugas atau foto lokasi kerja.
              </p>
            </div>

            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="size-3.5" />
              {location.status === "loading" ? "Mendeteksi lokasi..." : null}
              {location.status === "granted"
                ? "Lokasi GPS terdeteksi, akan disertakan sebagai informasi tambahan (jarak ke kantor)."
                : null}
              {location.status === "unavailable"
                ? "Lokasi tidak tersedia — pengajuan tetap bisa dikirim."
                : null}
            </p>

            {state?.error ? (
              <p className="text-destructive text-sm">{state.error}</p>
            ) : null}
            <div>
              <Button type="submit" disabled={isPending || !!disabledReason}>
                {isPending ? "Mengirim..." : "Ajukan Izin Absen Diluar Kantor"}
              </Button>
            </div>
          </fieldset>
        </form>
      </CardContent>
    </Card>
  )
}
