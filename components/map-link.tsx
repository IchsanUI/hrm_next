import { MapPin } from "lucide-react"

// Link "Lihat di Peta" — buka Google Maps di tab baru pada koordinat yang
// dicatat sistem (mis. lokasi saat mengajukan izin, atau saat konfirmasi
// kedatangan). null lat/lng (mis. device lama yang belum kirim koordinat,
// cuma label jarak) = tidak render apa-apa, bukan link mati.
export function MapLink({
  lat,
  lng,
  className,
}: {
  lat: number | null | undefined
  lng: number | null | undefined
  className?: string
}) {
  if (lat === null || lat === undefined || lng === null || lng === undefined) return null

  return (
    <a
      href={`https://www.google.com/maps?q=${lat},${lng}`}
      target="_blank"
      rel="noopener noreferrer"
      className={
        className ??
        "inline-flex items-center gap-1 text-xs font-medium text-primary underline-offset-4 hover:underline"
      }
    >
      <MapPin className="size-3 shrink-0" />
      Lihat di Peta
    </a>
  )
}
