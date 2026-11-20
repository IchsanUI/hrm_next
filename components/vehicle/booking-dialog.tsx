"use client"

import { createContext, useActionState, useContext, useEffect, useState, useTransition, type ReactNode } from "react"
import { CalendarClock, Car, Check, CircleSlash, MapPin, Minus, Plus, Sparkles, UserRound, Users } from "lucide-react"
import { toast } from "sonner"

import {
  checkVehicleAvailabilityAction,
  createVehicleBookingAction,
  type VehicleActionState,
  type VehicleAvailability,
} from "@/server/actions/vehicle-booking"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

type LaunchOptions = { vehicleId?: number; date?: string }
const BookingLauncherContext = createContext<(options?: LaunchOptions) => void>(() => {})

export function useBookingLauncher() {
  return useContext(BookingLauncherContext)
}

// Membungkus halaman Pinjam Mobil — tombol booking di mana pun (hero, kartu
// mobil, tombol bawah di HP) membuka dialog yang sama dengan isian awal.
export function BookingLauncherProvider({ children, today }: { children: ReactNode; today: string }) {
  const [options, setOptions] = useState<LaunchOptions | null>(null)
  return (
    <BookingLauncherContext.Provider value={(o) => setOptions(o ?? {})}>
      {children}
      <Dialog open={options !== null} onOpenChange={(open) => !open && setOptions(null)}>
        <DialogContent className="max-w-[calc(100%-1rem)] gap-5 p-4 sm:max-w-2xl sm:p-6">
          {options ? (
            <BookingForm
              key={`${options.vehicleId ?? ""}-${options.date ?? ""}`}
              initialVehicleId={options.vehicleId}
              initialDate={options.date ?? today}
              today={today}
              onDone={() => setOptions(null)}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </BookingLauncherContext.Provider>
  )
}

const PRESETS = [
  { label: "Pagi", start: "08:00", end: "12:00" },
  { label: "Siang", start: "13:00", end: "16:00" },
  { label: "Seharian", start: "08:00", end: "16:00" },
]

function BookingForm({
  initialVehicleId,
  initialDate,
  today,
  onDone,
}: {
  initialVehicleId?: number
  initialDate: string
  today: string
  onDone: () => void
}) {
  const [startDate, setStartDate] = useState(initialDate)
  const [startTime, setStartTime] = useState("08:00")
  const [endDate, setEndDate] = useState(initialDate)
  const [endTime, setEndTime] = useState("12:00")
  const [vehicleId, setVehicleId] = useState<number | undefined>(initialVehicleId)
  const [passengers, setPassengers] = useState(1)
  const [needsDriver, setNeedsDriver] = useState(false)
  const [vehicles, setVehicles] = useState<VehicleAvailability[] | null>(null)
  const [isChecking, startChecking] = useTransition()
  const [state, formAction, isPending] = useActionState<VehicleActionState, FormData>(createVehicleBookingAction, undefined)

  const startAt = `${startDate}T${startTime}`
  const endAt = `${endDate}T${endTime}`

  // Cek ketersediaan setiap kali jam berubah (sedikit ditunda supaya tidak
  // memanggil server di setiap ketukan).
  useEffect(() => {
    const id = setTimeout(() => {
      startChecking(async () => {
        const result = await checkVehicleAvailabilityAction(startAt, endAt)
        setVehicles(result)
      })
    }, 250)
    return () => clearTimeout(id)
  }, [startAt, endAt])

  // Mobil terpilih ternyata bentrok di jam baru → lepas pilihannya.
  const selected = vehicles?.find((v) => v.id === vehicleId)
  const selectedUsable = selected?.available ? selected : undefined

  useEffect(() => {
    if (state?.error) toast.error(state.error)
    if (state?.success) {
      toast.success(state.message ?? "Booking terkirim.")
      onDone()
    }
  }, [state, onDone])

  const maxSeats = selectedUsable ? selectedUsable.capacity - (needsDriver ? 1 : 0) : 20

  return (
    <form action={formAction} className="grid gap-5">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 text-lg">
          <Car className="size-5 text-primary" />
          Booking Mobil Kantor
        </DialogTitle>
        <DialogDescription>Pilih jam, lalu pilih mobil yang masih kosong. Petugas Umum akan mengonfirmasi.</DialogDescription>
      </DialogHeader>

      <input type="hidden" name="startAt" value={startAt} />
      <input type="hidden" name="endAt" value={endAt} />
      <input type="hidden" name="vehicleId" value={selectedUsable?.id ?? ""} />
      <input type="hidden" name="passengerCount" value={passengers} />
      {needsDriver ? <input type="hidden" name="needsDriver" value="on" /> : null}

      {/* 1. Waktu */}
      <section className="grid gap-3">
        <SectionTitle icon={<CalendarClock className="size-4" />} step={1} title="Kapan dipakai?" />
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => {
                setStartTime(p.start)
                setEndTime(p.end)
                setEndDate(startDate)
              }}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                startTime === p.start && endTime === p.end && endDate === startDate
                  ? "border-primary bg-primary text-primary-foreground"
                  : "hover:bg-muted"
              )}
            >
              {p.label} · {p.start}–{p.end}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="bk-start-date" className="text-xs text-muted-foreground">Tanggal mulai</Label>
            <Input
              id="bk-start-date"
              type="date"
              min={today}
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value)
                if (endDate < e.target.value) setEndDate(e.target.value)
              }}
              required
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="bk-start-time" className="text-xs text-muted-foreground">Jam mulai</Label>
            <Input id="bk-start-time" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="bk-end-date" className="text-xs text-muted-foreground">Tanggal selesai</Label>
            <Input id="bk-end-date" type="date" min={startDate} value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="bk-end-time" className="text-xs text-muted-foreground">Jam selesai</Label>
            <Input id="bk-end-time" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} required />
          </div>
        </div>
      </section>

      {/* 2. Mobil */}
      <section className="grid gap-3">
        <SectionTitle
          icon={<Car className="size-4" />}
          step={2}
          title="Pilih mobil"
          aside={isChecking ? <span className="text-xs text-muted-foreground">Mengecek jadwal…</span> : null}
        />
        {vehicles === null ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {[0, 1].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        ) : vehicles.length === 0 ? (
          <p className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">
            Belum ada mobil terdaftar di lokasi Anda.
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {vehicles.map((v) => {
              const active = selectedUsable?.id === v.id
              return (
                <button
                  key={v.id}
                  type="button"
                  disabled={!v.available}
                  onClick={() => setVehicleId(v.id)}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border p-2.5 text-left transition-all",
                    active ? "border-primary bg-primary/5 ring-2 ring-primary/30" : "hover:border-primary/40 hover:bg-muted/50",
                    !v.available && "cursor-not-allowed opacity-55 hover:border-border hover:bg-transparent"
                  )}
                >
                  <VehicleThumb photoUrl={v.photoUrl} className="size-14 shrink-0 rounded-lg" />
                  <span className="grid min-w-0 flex-1 gap-0.5">
                    <span className="truncate text-sm font-semibold">{v.name}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {v.plateNumber} · {v.capacity} kursi
                    </span>
                    {v.available ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                        <Check className="size-3.5" /> Tersedia
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 truncate text-xs text-red-600 dark:text-red-400">
                        <CircleSlash className="size-3.5 shrink-0" /> {v.reason}
                      </span>
                    )}
                  </span>
                  {active ? (
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Check className="size-3.5" />
                    </span>
                  ) : null}
                </button>
              )
            })}
          </div>
        )}
      </section>

      {/* 3. Detail */}
      <section className="grid gap-3">
        <SectionTitle icon={<MapPin className="size-4" />} step={3} title="Tujuan & keperluan" />
        <Input name="destination" placeholder="Tujuan, mis. Kantor Cabang Driyorejo" maxLength={200} required />
        <Textarea name="purpose" placeholder="Keperluan, mis. survei agunan nasabah" rows={2} maxLength={1000} required />
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex items-center justify-between gap-3 rounded-xl border p-3">
            <span className="flex items-center gap-2 text-sm">
              <Users className="size-4 text-muted-foreground" />
              Penumpang
            </span>
            <span className="flex items-center gap-2">
              <Button type="button" size="icon-sm" variant="outline" onClick={() => setPassengers((n) => Math.max(1, n - 1))} aria-label="Kurangi penumpang">
                <Minus />
              </Button>
              <span className="w-6 text-center font-semibold tabular-nums">{passengers}</span>
              <Button
                type="button"
                size="icon-sm"
                variant="outline"
                onClick={() => setPassengers((n) => Math.min(maxSeats, n + 1))}
                disabled={passengers >= maxSeats}
                aria-label="Tambah penumpang"
              >
                <Plus />
              </Button>
            </span>
          </div>
          <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border p-3">
            <span className="flex items-center gap-2 text-sm">
              <UserRound className="size-4 text-muted-foreground" />
              <span>
                Perlu sopir
                <span className="block text-xs text-muted-foreground">Petugas menugaskan sopir kantor</span>
              </span>
            </span>
            <Switch
              checked={needsDriver}
              onCheckedChange={(v) => {
                setNeedsDriver(v)
                if (selectedUsable && v) setPassengers((n) => Math.min(n, selectedUsable.capacity - 1))
              }}
            />
          </label>
        </div>
      </section>

      <Button type="submit" size="lg" className="w-full" disabled={isPending || !selectedUsable}>
        <Sparkles className="size-4" />
        {isPending ? "Mengirim…" : selectedUsable ? `Booking ${selectedUsable.name}` : "Pilih mobil yang tersedia"}
      </Button>
    </form>
  )
}

function SectionTitle({ icon, step, title, aside }: { icon: ReactNode; step: number; title: string; aside?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <span className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-xs text-primary">{step}</span>
        {icon}
        {title}
      </p>
      {aside}
    </div>
  )
}

// Foto mobil, atau ilustrasi gradien kalau belum ada foto.
export function VehicleThumb({ photoUrl, className }: { photoUrl: string | null; className?: string }) {
  if (photoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={photoUrl} alt="" className={cn("object-cover", className)} />
  }
  return (
    <span
      className={cn(
        "flex items-center justify-center bg-gradient-to-br from-blue-500 to-indigo-700 text-white dark:from-blue-600 dark:to-indigo-900",
        className
      )}
    >
      <Car className="size-1/2 opacity-90" />
    </span>
  )
}

export function BookButton({
  children,
  vehicleId,
  date,
  ...props
}: React.ComponentProps<typeof Button> & LaunchOptions) {
  const launch = useBookingLauncher()
  return (
    <Button type="button" onClick={() => launch({ vehicleId, date })} {...props}>
      {children}
    </Button>
  )
}
