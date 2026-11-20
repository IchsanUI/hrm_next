import { CalendarPlus, Users, Wrench } from "lucide-react"

import { BookButton, VehicleThumb } from "@/components/vehicle/booking-dialog"
import {
  BOOKING_BAR_CLASS,
  BOOKING_STATUS_LABEL,
  TIMELINE_END_HOUR,
  TIMELINE_START_HOUR,
  type VehicleBookingStatusValue,
} from "@/lib/vehicle-booking-labels"
import { cn } from "@/lib/utils"

export type DayCardVehicle = {
  id: number
  name: string
  plateNumber: string
  capacity: number
  color: string | null
  photoUrl: string | null
  status: "TERSEDIA" | "SERVIS" | "NONAKTIF"
  bookings: {
    id: number
    startAt: Date
    endAt: Date
    status: VehicleBookingStatusValue
    destination: string
    requester: { fullName: string }
  }[]
}

const HOURS = TIMELINE_END_HOUR - TIMELINE_START_HOUR
const TICKS = [6, 9, 12, 15, 18, 21]

function time(d: Date) {
  return d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
}

// Kartu satu mobil untuk satu hari: foto, info, timeline 06.00–22.00 berisi
// balok jadwal terpakai, daftar jadwal (lebih mudah dibaca di HP), dan
// tombol booking.
export function VehicleDayCard({
  vehicle,
  dayStart,
  dateValue,
  now,
}: {
  vehicle: DayCardVehicle
  dayStart: Date
  dateValue: string
  now: Date
}) {
  const windowStart = new Date(dayStart)
  windowStart.setHours(TIMELINE_START_HOUR, 0, 0, 0)
  const windowMs = HOURS * 3_600_000

  const segments = vehicle.bookings
    .map((b) => {
      const start = Math.max(b.startAt.getTime(), windowStart.getTime())
      const end = Math.min(b.endAt.getTime(), windowStart.getTime() + windowMs)
      if (end <= start) return null
      return {
        ...b,
        left: ((start - windowStart.getTime()) / windowMs) * 100,
        width: Math.max(((end - start) / windowMs) * 100, 1.5),
      }
    })
    .filter((s): s is NonNullable<typeof s> => s !== null)

  const nowPct = ((now.getTime() - windowStart.getTime()) / windowMs) * 100
  const showNow = nowPct >= 0 && nowPct <= 100
  const inService = vehicle.status === "SERVIS"
  const busyNow = vehicle.bookings.some((b) => b.startAt <= now && b.endAt > now)

  return (
    <article className="overflow-hidden rounded-2xl border bg-card shadow-xs">
      <div className="flex gap-3 p-3 sm:p-4">
        <VehicleThumb photoUrl={vehicle.photoUrl} className="h-20 w-28 shrink-0 rounded-xl sm:h-24 sm:w-36" />
        <div className="grid min-w-0 flex-1 content-start gap-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="truncate font-semibold">{vehicle.name}</h3>
            {inService ? (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
                <Wrench className="size-3" /> Servis
              </span>
            ) : busyNow ? (
              <span className="shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-medium text-blue-800 dark:bg-blue-500/15 dark:text-blue-300">
                Sedang dipakai
              </span>
            ) : (
              <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300">
                Siap
              </span>
            )}
          </div>
          <p className="font-mono text-xs tracking-wide text-muted-foreground">{vehicle.plateNumber}</p>
          <p className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Users className="size-3.5" /> {vehicle.capacity} kursi
            </span>
            {vehicle.color ? <span>{vehicle.color}</span> : null}
          </p>
        </div>
      </div>

      {/* Timeline */}
      <div className="px-3 sm:px-4">
        <div className="relative h-7 overflow-hidden rounded-lg bg-muted">
          {TICKS.slice(1).map((h) => (
            <span
              key={h}
              className="absolute inset-y-0 w-px bg-foreground/10"
              style={{ left: `${((h - TIMELINE_START_HOUR) / HOURS) * 100}%` }}
            />
          ))}
          {segments.map((s) => (
            <span
              key={s.id}
              title={`${time(s.startAt)}–${time(s.endAt)} · ${s.requester.fullName}`}
              className={cn("absolute inset-y-1 rounded-md", BOOKING_BAR_CLASS[s.status])}
              style={{ left: `${s.left}%`, width: `${s.width}%` }}
            />
          ))}
          {showNow ? (
            <span className="absolute inset-y-0 w-0.5 bg-red-500" style={{ left: `${nowPct}%` }} aria-label="Sekarang" />
          ) : null}
        </div>
        <div className="relative mt-1 h-4 text-[10px] text-muted-foreground">
          {TICKS.map((h) => (
            <span
              key={h}
              className="absolute -translate-x-1/2 first:translate-x-0"
              style={{ left: `${((h - TIMELINE_START_HOUR) / HOURS) * 100}%` }}
            >
              {String(h).padStart(2, "0")}
            </span>
          ))}
        </div>
      </div>

      <div className="grid gap-3 p-3 pt-2 sm:p-4 sm:pt-2">
        {vehicle.bookings.length ? (
          <ul className="grid gap-1.5">
            {vehicle.bookings.map((b) => (
              <li key={b.id} className="flex items-center gap-2 text-xs">
                <span className={cn("size-2 shrink-0 rounded-full", BOOKING_BAR_CLASS[b.status])} />
                <span className="font-medium tabular-nums">
                  {b.startAt < dayStart ? "…" : time(b.startAt)}–{time(b.endAt)}
                </span>
                <span className="min-w-0 truncate text-muted-foreground">
                  {b.requester.fullName.split(" ")[0]} · {b.destination}
                </span>
                <span className="ml-auto shrink-0 text-muted-foreground">{BOOKING_STATUS_LABEL[b.status]}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">{inService ? "Mobil sedang servis." : "Kosong sepanjang hari 🎉"}</p>
        )}
        <BookButton
          vehicleId={vehicle.id}
          date={dateValue}
          variant={inService ? "outline" : "secondary"}
          className="w-full"
          disabled={inService}
        >
          <CalendarPlus className="size-4" />
          {inService ? "Tidak bisa dibooking" : "Booking mobil ini"}
        </BookButton>
      </div>
    </article>
  )
}
