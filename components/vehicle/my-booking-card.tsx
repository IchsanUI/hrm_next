"use client"

import { useState, useTransition } from "react"
import { CalendarClock, CarFront, Gauge, MapPin, UserRound, X } from "lucide-react"
import { toast } from "sonner"

import { cancelVehicleBookingAction } from "@/server/actions/vehicle-booking"
import { VehicleThumb } from "@/components/vehicle/booking-dialog"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { BOOKING_STATUS_CLASS, BOOKING_STATUS_LABEL, type VehicleBookingStatusValue } from "@/lib/vehicle-booking-labels"
import { cn } from "@/lib/utils"

export type MyBooking = {
  publicId: string
  bookingNumber: string
  status: VehicleBookingStatusValue
  whenLabel: string
  relativeLabel: string | null
  destination: string
  purpose: string
  vehicleName: string
  plateNumber: string
  photoUrl: string | null
  driverName: string | null
  needsDriver: boolean
  note: string | null // alasan tolak/batal atau catatan petugas
  canCancel: boolean
  kmLabel: string | null
}

export function MyBookingCard({ booking, compact = false }: { booking: MyBooking; compact?: boolean }) {
  const [confirming, setConfirming] = useState(false)
  const [isPending, startTransition] = useTransition()

  function cancel() {
    startTransition(async () => {
      const result = await cancelVehicleBookingAction(booking.publicId, "")
      if (result?.error) toast.error(result.error)
      else toast.success("Booking dibatalkan.")
      setConfirming(false)
    })
  }

  return (
    <article className={cn("flex gap-3 rounded-2xl border bg-card p-3", !compact && "sm:p-4")}>
      <VehicleThumb photoUrl={booking.photoUrl} className={cn("shrink-0 rounded-xl", compact ? "size-12" : "size-16")} />
      <div className="grid min-w-0 flex-1 gap-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="truncate font-semibold">{booking.vehicleName}</p>
          <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-medium", BOOKING_STATUS_CLASS[booking.status])}>
            {BOOKING_STATUS_LABEL[booking.status]}
          </span>
        </div>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <CalendarClock className="size-3.5 shrink-0" />
          <span className="truncate">
            {booking.whenLabel}
            {booking.relativeLabel ? <span className="font-medium text-foreground"> · {booking.relativeLabel}</span> : null}
          </span>
        </p>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <MapPin className="size-3.5 shrink-0" />
          <span className="truncate">{booking.destination}</span>
        </p>
        {booking.needsDriver ? (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <UserRound className="size-3.5 shrink-0" />
            {booking.driverName ? `Sopir: ${booking.driverName}` : "Meminta sopir"}
          </p>
        ) : null}
        {booking.kmLabel ? (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Gauge className="size-3.5 shrink-0" />
            {booking.kmLabel}
          </p>
        ) : null}
        {booking.note ? <p className="rounded-lg bg-muted px-2.5 py-1.5 text-xs">{booking.note}</p> : null}
        <p className="font-mono text-[10px] text-muted-foreground">{booking.bookingNumber}</p>
      </div>
      {booking.canCancel ? (
        <>
          <Button
            variant="ghost"
            size="icon-sm"
            className="shrink-0 text-muted-foreground hover:text-destructive"
            aria-label="Batalkan booking"
            onClick={() => setConfirming(true)}
          >
            <X />
          </Button>
          <AlertDialog open={confirming} onOpenChange={setConfirming}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Batalkan booking?</AlertDialogTitle>
                <AlertDialogDescription>
                  {booking.vehicleName}, {booking.whenLabel}. Jadwal mobil akan dibuka kembali untuk pegawai lain.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Tidak</AlertDialogCancel>
                <AlertDialogAction variant="destructive" disabled={isPending} onClick={cancel}>
                  {isPending ? "Membatalkan…" : "Ya, batalkan"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      ) : null}
    </article>
  )
}

export type DriverTask = {
  publicId: string
  whenLabel: string
  vehicleName: string
  plateNumber: string
  requesterName: string
  destination: string
  status: VehicleBookingStatusValue
}

export function DriverTaskCard({ task }: { task: DriverTask }) {
  return (
    <article className="flex items-center gap-3 rounded-2xl border border-violet-200 bg-violet-50/60 p-3 dark:border-violet-500/25 dark:bg-violet-500/10">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-violet-600 text-white">
        <CarFront className="size-5" />
      </span>
      <div className="grid min-w-0 gap-0.5">
        <p className="truncate text-sm font-semibold">
          {task.vehicleName} · <span className="font-mono text-xs">{task.plateNumber}</span>
        </p>
        <p className="truncate text-xs text-muted-foreground">{task.whenLabel}</p>
        <p className="truncate text-xs text-muted-foreground">
          Antar {task.requesterName} → {task.destination}
        </p>
      </div>
      <span className={cn("ml-auto shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium", BOOKING_STATUS_CLASS[task.status])}>
        {BOOKING_STATUS_LABEL[task.status]}
      </span>
    </article>
  )
}
