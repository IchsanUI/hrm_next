"use client"

import { useActionState, useEffect, useState } from "react"
import { MapPin } from "lucide-react"
import { toast } from "sonner"

import { createOvertimeRequestAction, type OvertimeFormState } from "@/server/actions/overtime"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

type LocationState =
  | { status: "loading" }
  | { status: "granted"; lat: number; lng: number }
  | { status: "unavailable" }

function todayDateInputValue() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function OvertimeRequestForm() {
  const [state, formAction, isPending] = useActionState<OvertimeFormState, FormData>(
    createOvertimeRequestAction,
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
        <CardTitle>Form Pengajuan Izin Lembur</CardTitle>
        <CardDescription>
          Isi rencana lembur Anda. Pengajuan akan dikirim ke atasan langsung
          untuk disetujui sebelum lembur dilaksanakan.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="grid gap-4">
          {location.status === "granted" ? (
            <>
              <input type="hidden" name="locationLat" value={location.lat} />
              <input type="hidden" name="locationLng" value={location.lng} />
            </>
          ) : null}

          <div className="grid gap-2">
            <Label htmlFor="date">Tanggal Lembur</Label>
            <Input id="date" name="date" type="date" min={todayDateInputValue()} required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="task">Tugas Lembur</Label>
            <Textarea
              id="task"
              name="task"
              placeholder="Jelaskan pekerjaan yang akan dikerjakan saat lembur"
              required
            />
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
              {isPending ? "Mengirim..." : "Ajukan Izin Lembur"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
