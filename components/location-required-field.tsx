"use client"

import { useCallback, useEffect, useState } from "react"
import { MapPin } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"

export type RequiredLocationState =
  | { status: "loading" }
  | { status: "granted"; lat: number; lng: number }
  | { status: "unavailable" }

// Dipakai bareng LocationRequiredField di bawah — form pemanggil WAJIB
// nge-gate tombol submit-nya sendiri lewat `location.status !== "granted"`,
// komponen ini cuma urus deteksi & tampilan, tidak bisa memblokir submit
// form dari dalam sini.
export function useRequiredLocation() {
  const [location, setLocation] = useState<RequiredLocationState>({ status: "loading" })

  const request = useCallback(() => {
    setLocation({ status: "loading" })
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

  useEffect(() => {
    request()
  }, [request])

  return { location, retryLocation: request }
}

// Field lokasi WAJIB (bukan opsional lagi) — dipakai form yang butuh
// koordinat GPS (Lembur, Absen Diluar Kantor, Terlambat). Merender hidden
// input locationLat/locationLng kalau granted, garis status/peringatan, dan
// modal arahan yang otomatis kebuka begitu status "unavailable" (browser
// menolak izin / tidak mendukung geolocation).
export function LocationRequiredField({
  location,
  onRetry,
}: {
  location: RequiredLocationState
  onRetry: () => void
}) {
  const [guideOpen, setGuideOpen] = useState(false)

  useEffect(() => {
    if (location.status === "unavailable") setGuideOpen(true)
  }, [location.status])

  return (
    <>
      {location.status === "granted" ? (
        <>
          <input type="hidden" name="locationLat" value={location.lat} />
          <input type="hidden" name="locationLng" value={location.lng} />
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="size-3.5" />
            Lokasi terdeteksi.
          </p>
        </>
      ) : (
        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <MapPin className="mt-0.5 size-4 shrink-0" />
          <div className="min-w-0 flex-1">
            <p>
              {location.status === "loading"
                ? "Mendeteksi lokasi..."
                : "Lokasi wajib diaktifkan untuk mengajukan izin ini."}
            </p>
            {location.status === "unavailable" ? (
              <div className="mt-2 flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="outline" onClick={onRetry}>
                  Coba Lagi
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setGuideOpen(true)}>
                  Cara Aktifkan Lokasi
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      )}

      <Dialog open={guideOpen} onOpenChange={setGuideOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aktifkan Izin Lokasi</DialogTitle>
            <DialogDescription>
              Pengajuan izin ini wajib menyertakan lokasi Anda — izinkan akses lokasi di browser
              supaya bisa mengajukan.
            </DialogDescription>
          </DialogHeader>
          <ol className="grid gap-2 text-sm">
            <li className="flex gap-2.5">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                1
              </span>
              <span className="pt-0.5">
                Klik ikon gembok/info di sebelah kiri alamat situs, di browser Anda.
              </span>
            </li>
            <li className="flex gap-2.5">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                2
              </span>
              <span className="pt-0.5">
                Cari pengaturan &quot;Lokasi&quot; / &quot;Location&quot;, ubah jadi &quot;Izinkan&quot; /
                &quot;Allow&quot;.
              </span>
            </li>
            <li className="flex gap-2.5">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                3
              </span>
              <span className="pt-0.5">Klik &quot;Coba Lagi&quot; di bawah ini.</span>
            </li>
          </ol>
          <DialogFooter>
            <Button
              type="button"
              onClick={() => {
                onRetry()
                setGuideOpen(false)
              }}
            >
              Coba Lagi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
