"use client"

import { useActionState, useEffect, useState, useTransition } from "react"
import { CalendarClock, Check, KeyRound, MapPin, Undo2, UserRound, Users, X } from "lucide-react"
import { toast } from "sonner"

import {
  approveVehicleBookingAction,
  cancelVehicleBookingAction,
  departVehicleBookingAction,
  getApprovalOptionsAction,
  rejectVehicleBookingAction,
  returnVehicleBookingAction,
  type VehicleActionState,
} from "@/server/actions/vehicle-booking"
import { VehicleThumb } from "@/components/vehicle/booking-dialog"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { BOOKING_STATUS_CLASS, BOOKING_STATUS_LABEL, MAX_ODOMETER_KM, type VehicleBookingStatusValue } from "@/lib/vehicle-booking-labels"
import { cn } from "@/lib/utils"

export type PetugasBooking = {
  publicId: string
  bookingNumber: string
  status: VehicleBookingStatusValue
  whenLabel: string
  requesterName: string
  requesterPosition: string
  destination: string
  purpose: string
  passengerCount: number
  needsDriver: boolean
  driverName: string | null
  vehicleId: number
  vehicleName: string
  plateNumber: string
  photoUrl: string | null
  lastOdometerKm: number | null
  startKm: number | null
  overdue: boolean
  note: string | null
}

type DialogKind = "approve" | "reject" | "depart" | "return" | "cancel" | null

const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-2.5 text-sm shadow-xs outline-none focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"

export function PetugasBookingCard({ booking }: { booking: PetugasBooking }) {
  const [dialog, setDialog] = useState<DialogKind>(null)
  const close = () => setDialog(null)

  return (
    <article
      className={cn(
        "grid gap-3 rounded-2xl border bg-card p-3 sm:p-4",
        booking.overdue && "border-red-300 dark:border-red-500/40"
      )}
    >
      <div className="flex gap-3">
        <VehicleThumb photoUrl={booking.photoUrl} className="size-14 shrink-0 rounded-xl" />
        <div className="grid min-w-0 flex-1 gap-0.5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="truncate font-semibold">{booking.requesterName}</p>
            <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-medium", BOOKING_STATUS_CLASS[booking.status])}>
              {booking.overdue ? "Terlambat kembali" : BOOKING_STATUS_LABEL[booking.status]}
            </span>
          </div>
          <p className="truncate text-xs text-muted-foreground">{booking.requesterPosition}</p>
          <p className="truncate text-xs">
            {booking.vehicleName} · <span className="font-mono">{booking.plateNumber}</span>
          </p>
        </div>
      </div>

      <div className="grid gap-1 text-xs text-muted-foreground">
        <p className="flex items-center gap-1.5">
          <CalendarClock className="size-3.5 shrink-0" /> {booking.whenLabel}
        </p>
        <p className="flex items-center gap-1.5">
          <MapPin className="size-3.5 shrink-0" /> <span className="truncate">{booking.destination}</span>
        </p>
        <p className="flex items-center gap-1.5">
          <Users className="size-3.5 shrink-0" /> {booking.passengerCount} penumpang
          <span className="mx-1">·</span>
          <UserRound className="size-3.5 shrink-0" />{" "}
          {booking.driverName ? `Sopir: ${booking.driverName}` : booking.needsDriver ? "Minta sopir" : "Menyetir sendiri"}
        </p>
        <p className="rounded-lg bg-muted px-2.5 py-1.5 text-foreground">{booking.purpose}</p>
        {booking.note ? <p className="italic">{booking.note}</p> : null}
        <p className="font-mono text-[10px]">{booking.bookingNumber}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {booking.status === "MENUNGGU" ? (
          <>
            <Button size="sm" className="flex-1 sm:flex-none" onClick={() => setDialog("approve")}>
              <Check /> Setujui
            </Button>
            <Button size="sm" variant="outline" className="flex-1 text-destructive sm:flex-none" onClick={() => setDialog("reject")}>
              <X /> Tolak
            </Button>
          </>
        ) : null}
        {booking.status === "DISETUJUI" ? (
          <>
            <Button size="sm" className="flex-1 sm:flex-none" onClick={() => setDialog("depart")}>
              <KeyRound /> Serahkan Kunci
            </Button>
            <Button size="sm" variant="outline" className="flex-1 text-destructive sm:flex-none" onClick={() => setDialog("cancel")}>
              <X /> Batalkan
            </Button>
          </>
        ) : null}
        {booking.status === "BERJALAN" ? (
          <Button size="sm" className="flex-1 sm:flex-none" onClick={() => setDialog("return")}>
            <Undo2 /> Terima Kembali
          </Button>
        ) : null}
      </div>

      <Dialog open={dialog !== null} onOpenChange={(open) => !open && close()}>
        <DialogContent className="max-w-[calc(100%-1rem)] sm:max-w-md">
          {dialog === "approve" ? <ApproveForm booking={booking} onDone={close} /> : null}
          {dialog === "reject" ? (
            <SimpleForm
              title="Tolak booking"
              description={`${booking.requesterName} · ${booking.whenLabel}`}
              action={rejectVehicleBookingAction.bind(null, booking.publicId)}
              submitLabel="Tolak Booking"
              destructive
              onDone={close}
            >
              <Label htmlFor="reason">Alasan</Label>
              <Textarea id="reason" name="reason" required minLength={3} maxLength={500} placeholder="Mis. mobil dipakai Direksi" />
            </SimpleForm>
          ) : null}
          {dialog === "depart" ? (
            <SimpleForm
              title="Serahkan kunci"
              description={`${booking.vehicleName} · ${booking.plateNumber} kepada ${booking.requesterName}`}
              action={departVehicleBookingAction.bind(null, booking.publicId)}
              submitLabel="Catat Keberangkatan"
              onDone={close}
            >
              <Label htmlFor="startKm">KM awal (odometer)</Label>
              <Input id="startKm" name="startKm" type="number" inputMode="numeric" min={0} max={MAX_ODOMETER_KM} defaultValue={booking.lastOdometerKm ?? ""} required />
            </SimpleForm>
          ) : null}
          {dialog === "return" ? (
            <SimpleForm
              title="Terima mobil kembali"
              description={`${booking.vehicleName} · KM awal ${booking.startKm ?? "-"}`}
              action={returnVehicleBookingAction.bind(null, booking.publicId)}
              submitLabel="Catat Pengembalian"
              onDone={close}
            >
              <Label htmlFor="endKm">KM akhir (odometer)</Label>
              <Input id="endKm" name="endKm" type="number" inputMode="numeric" min={booking.startKm ?? 0} max={MAX_ODOMETER_KM} required />
              <Label htmlFor="returnNote" className="mt-2">Kondisi / catatan (opsional)</Label>
              <Textarea id="returnNote" name="returnNote" maxLength={1000} placeholder="Mis. bensin tersisa ¼, lampu kiri mati" />
            </SimpleForm>
          ) : null}
          {dialog === "cancel" ? <CancelForm booking={booking} onDone={close} /> : null}
        </DialogContent>
      </Dialog>
    </article>
  )
}

function SimpleForm({
  title,
  description,
  action,
  submitLabel,
  destructive,
  onDone,
  children,
}: {
  title: string
  description: string
  action: (prev: VehicleActionState, formData: FormData) => Promise<VehicleActionState>
  submitLabel: string
  destructive?: boolean
  onDone: () => void
  children: React.ReactNode
}) {
  const [state, formAction, isPending] = useActionState<VehicleActionState, FormData>(action, undefined)
  useEffect(() => {
    if (state?.error) toast.error(state.error)
    if (state?.success) {
      toast.success(state.message ?? "Tersimpan.")
      onDone()
    }
  }, [state, onDone])

  return (
    <form action={formAction} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      <div className="grid gap-1.5">{children}</div>
      <DialogFooter>
        <Button type="submit" variant={destructive ? "destructive" : "default"} disabled={isPending} className="w-full sm:w-auto">
          {isPending ? "Menyimpan…" : submitLabel}
        </Button>
      </DialogFooter>
    </form>
  )
}

type Options = NonNullable<Awaited<ReturnType<typeof getApprovalOptionsAction>>>

function ApproveForm({ booking, onDone }: { booking: PetugasBooking; onDone: () => void }) {
  const [options, setOptions] = useState<Options | null>(null)
  const [, startLoading] = useTransition()
  useEffect(() => {
    startLoading(async () => setOptions(await getApprovalOptionsAction(booking.publicId)))
  }, [booking.publicId])

  return (
    <SimpleForm
      title="Setujui booking"
      description={`${booking.requesterName} · ${booking.whenLabel}`}
      action={approveVehicleBookingAction.bind(null, booking.publicId)}
      submitLabel="Setujui"
      onDone={onDone}
    >
      {options === null ? (
        <div className="grid gap-2">
          <div className="h-9 animate-pulse rounded-md bg-muted" />
          <div className="h-9 animate-pulse rounded-md bg-muted" />
        </div>
      ) : (
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="vehicleId">Mobil</Label>
            <select id="vehicleId" name="vehicleId" defaultValue={booking.vehicleId} className={selectClass}>
              {options.vehicleOptions.map((v) => (
                <option key={v.id} value={v.id} disabled={!!v.conflict}>
                  {v.label}
                  {v.conflict ? ` — bentrok ${v.conflict}` : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="driverId">Sopir {booking.needsDriver ? <span className="text-destructive">*</span> : "(opsional)"}</Label>
            <select id="driverId" name="driverId" defaultValue={booking.needsDriver ? "" : "self"} required={booking.needsDriver} className={selectClass}>
              {booking.needsDriver ? <option value="">— Pilih sopir —</option> : null}
              <option value="self">Menyetir sendiri ({booking.requesterName})</option>
              {options.driverOptions.map((d) => (
                <option key={d.id} value={d.id} disabled={!!d.conflict}>
                  {d.label}
                  {d.conflict ? ` — bertugas ${d.conflict}` : ""}
                </option>
              ))}
            </select>
            {booking.needsDriver && !options.driverOptions.length ? (
              <p className="text-xs text-muted-foreground">Belum ada sopir terdaftar — pilih &quot;Menyetir sendiri&quot; atau tambah sopir di Kendaraan Dinas.</p>
            ) : null}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="note">Catatan untuk pemohon (opsional)</Label>
            <Input id="note" name="note" maxLength={500} placeholder="Mis. kunci diambil di pos satpam" />
          </div>
        </div>
      )}
    </SimpleForm>
  )
}

function CancelForm({ booking, onDone }: { booking: PetugasBooking; onDone: () => void }) {
  const [reason, setReason] = useState("")
  const [isPending, startTransition] = useTransition()
  return (
    <div className="grid gap-4">
      <DialogHeader>
        <DialogTitle>Batalkan booking</DialogTitle>
        <DialogDescription>
          {booking.requesterName} · {booking.whenLabel}. Pemohon akan diberi tahu.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-1.5">
        <Label htmlFor="cancelReason">Alasan</Label>
        <Textarea id="cancelReason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
      </div>
      <DialogFooter>
        <Button
          variant="destructive"
          className="w-full sm:w-auto"
          disabled={isPending || reason.trim().length < 3}
          onClick={() =>
            startTransition(async () => {
              const result = await cancelVehicleBookingAction(booking.publicId, reason)
              if (result?.error) toast.error(result.error)
              else {
                toast.success("Booking dibatalkan.")
                onDone()
              }
            })
          }
        >
          {isPending ? "Membatalkan…" : "Batalkan Booking"}
        </Button>
      </DialogFooter>
    </div>
  )
}
