import Link from "next/link"
import { redirect } from "next/navigation"
import { connection } from "next/server"
import { CalendarCheck2, CalendarPlus, Car, CarFront, History, MapPin, Sparkles } from "lucide-react"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { ACTIVE_BOOKING_STATUSES, formatTimeRange, getVehiclesWithBookings } from "@/lib/vehicle-booking"
import { BOOKING_BAR_CLASS } from "@/lib/vehicle-booking-labels"
import { Breadcrumb } from "@/components/breadcrumb"
import { BookButton, BookingLauncherProvider } from "@/components/vehicle/booking-dialog"
import { VehicleDayCard } from "@/components/vehicle/vehicle-day-card"
import { DriverTaskCard, MyBookingCard, type MyBooking } from "@/components/vehicle/my-booking-card"
import { cn } from "@/lib/utils"

const DAY_STRIP = 14

function toDateValue(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function relativeLabel(startAt: Date, endAt: Date, now: Date) {
  if (startAt <= now && endAt > now) return "berlangsung"
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const day = new Date(startAt.getFullYear(), startAt.getMonth(), startAt.getDate())
  const diff = Math.round((day.getTime() - today.getTime()) / 86_400_000)
  if (diff === 0) return "hari ini"
  if (diff === 1) return "besok"
  if (diff > 1) return `${diff} hari lagi`
  return null
}

type BookingRow = Awaited<ReturnType<typeof loadMyBookings>>[number]

function loadMyBookings(employeeId: number, where: object, take: number, order: "asc" | "desc") {
  return prisma.vehicleBooking.findMany({
    where: { requesterId: employeeId, ...where },
    orderBy: { startAt: order },
    take,
    include: {
      vehicle: { select: { name: true, plateNumber: true, photoUrl: true } },
      driver: { select: { fullName: true } },
    },
  })
}

function toMyBooking(b: BookingRow, now: Date): MyBooking {
  const note =
    b.status === "DITOLAK"
      ? `Ditolak: ${b.rejectionReason ?? "-"}`
      : b.status === "DIBATALKAN"
        ? b.cancelReason
          ? `Dibatalkan: ${b.cancelReason}`
          : null
        : b.handlerNote
          ? `Catatan petugas: ${b.handlerNote}`
          : b.status === "SELESAI" && b.returnNote
            ? `Kondisi: ${b.returnNote}`
            : null
  return {
    publicId: b.publicId,
    bookingNumber: b.bookingNumber,
    status: b.status,
    whenLabel: formatTimeRange(b.startAt, b.endAt),
    relativeLabel: b.status === "MENUNGGU" || b.status === "DISETUJUI" || b.status === "BERJALAN" ? relativeLabel(b.startAt, b.endAt, now) : null,
    destination: b.destination,
    purpose: b.purpose,
    vehicleName: b.vehicle.name,
    plateNumber: b.vehicle.plateNumber,
    photoUrl: b.vehicle.photoUrl,
    driverName: b.driver?.fullName ?? null,
    needsDriver: b.needsDriver,
    note,
    canCancel: (b.status === "MENUNGGU" || b.status === "DISETUJUI") && b.startAt > now,
    kmLabel: b.status === "SELESAI" && b.startKm !== null && b.endKm !== null ? `${b.endKm - b.startKm} km ditempuh` : null,
  }
}

// Pinjam Mobil Kantor — pegawai melihat jadwal mobil di lokasi kerjanya &
// membooking. Persetujuan oleh Petugas Umum (/pegawai/kelola-kendaraan).
export default async function KendaraanPage({ searchParams }: { searchParams: Promise<{ tanggal?: string }> }) {
  await connection()
  const session = await auth()
  const employeeId = session?.user.employeeId
  if (!employeeId) redirect("/pegawai/dashboard")

  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { workLocationId: true, workLocation: { select: { name: true } } },
  })
  if (!employee) redirect("/pegawai/dashboard")

  const now = new Date()
  const today = toDateValue(now)
  const { tanggal } = await searchParams
  const dateValue = tanggal && /^\d{4}-\d{2}-\d{2}$/.test(tanggal) && tanggal >= today ? tanggal : today
  const dayStart = new Date(`${dateValue}T00:00:00`)
  const dayEnd = new Date(dayStart.getTime() + 86_400_000)

  const [vehicles, upcoming, history, driverTasks] = await Promise.all([
    getVehiclesWithBookings({ workLocationId: employee.workLocationId }, dayStart, dayEnd),
    loadMyBookings(employeeId, { status: { in: ACTIVE_BOOKING_STATUSES }, endAt: { gte: now } }, 10, "asc"),
    loadMyBookings(
      employeeId,
      { OR: [{ status: { notIn: ACTIVE_BOOKING_STATUSES } }, { endAt: { lt: now } }] },
      8,
      "desc"
    ),
    prisma.vehicleBooking.findMany({
      where: { driverId: employeeId, status: { in: ["DISETUJUI", "BERJALAN"] }, endAt: { gte: now } },
      orderBy: { startAt: "asc" },
      take: 5,
      include: { vehicle: { select: { name: true, plateNumber: true } }, requester: { select: { fullName: true } } },
    }),
  ])

  const readyNow = vehicles.filter(
    (v) => v.status === "TERSEDIA" && !v.bookings.some((b) => b.startAt <= now && b.endAt > now)
  ).length
  const days = Array.from({ length: DAY_STRIP }, (_, i) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + i))
  const dayLabel = dayStart.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" })

  return (
    <BookingLauncherProvider today={today}>
      <Breadcrumb items={[{ label: "Dashboard", href: "/pegawai/dashboard" }, { label: "Pinjam Mobil" }]} />

      {/* Hero */}
      <section className="relative mb-6 overflow-hidden rounded-3xl bg-gradient-to-br from-blue-950 via-blue-900 to-indigo-700 p-5 text-white shadow-lg sm:p-7">
        <Car className="pointer-events-none absolute -right-6 -bottom-8 size-48 rotate-[-8deg] text-white/10 sm:size-64" />
        <div className="relative grid gap-4">
          <div>
            <p className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-xs backdrop-blur">
              <MapPin className="size-3.5" />
              {employee.workLocation.name}
            </p>
            <h1 className="mt-3 text-2xl font-bold sm:text-3xl">Pinjam Mobil Kantor</h1>
            <p className="mt-1 max-w-xl text-sm text-white/80">
              Cek jadwal, pilih mobil yang kosong, dan ajukan dalam hitungan detik. Petugas Umum akan mengonfirmasi lewat
              notifikasi.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Stat value={readyNow} label="mobil siap sekarang" />
            <Stat value={vehicles.length} label="mobil di lokasi" />
            <Stat value={upcoming.length} label="booking aktif Anda" />
          </div>
          <div>
            <BookButton size="lg" className="bg-white px-4 text-blue-950 hover:bg-white/90">
              <CalendarPlus className="size-4" />
              Booking Mobil
            </BookButton>
          </div>
        </div>
      </section>

      {driverTasks.length ? (
        <section className="mb-6 grid gap-3">
          <SectionHeading icon={<CarFront className="size-4" />} title="Tugas Menyopir Anda" />
          <div className="grid gap-3 md:grid-cols-2">
            {driverTasks.map((t) => (
              <DriverTaskCard
                key={t.publicId}
                task={{
                  publicId: t.publicId,
                  whenLabel: formatTimeRange(t.startAt, t.endAt),
                  vehicleName: t.vehicle.name,
                  plateNumber: t.vehicle.plateNumber,
                  requesterName: t.requester.fullName,
                  destination: t.destination,
                  status: t.status,
                }}
              />
            ))}
          </div>
        </section>
      ) : null}

      <section className="mb-8 grid gap-3">
        <SectionHeading icon={<CalendarCheck2 className="size-4" />} title="Booking Saya" />
        {upcoming.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {upcoming.map((b) => (
              <MyBookingCard key={b.publicId} booking={toMyBooking(b, now)} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed p-6 text-center">
            <Sparkles className="size-6 text-primary" />
            <p className="text-sm font-medium">Belum ada booking aktif</p>
            <p className="text-xs text-muted-foreground">Butuh mobil untuk tugas luar? Cek jadwal di bawah lalu booking.</p>
          </div>
        )}
      </section>

      <section className="mb-8 grid gap-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <SectionHeading icon={<Car className="size-4" />} title="Jadwal Mobil" subtitle={dayLabel} />
          <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
            <Legend className={BOOKING_BAR_CLASS.MENUNGGU} label="Menunggu" />
            <Legend className={BOOKING_BAR_CLASS.DISETUJUI} label="Dibooking" />
            <Legend className={BOOKING_BAR_CLASS.BERJALAN} label="Dipakai" />
            <Legend className="bg-red-500" label="Sekarang" />
          </div>
        </div>

        {/* Pilih hari — bisa digeser di HP */}
        <nav className="-mx-3 flex snap-x gap-2 overflow-x-auto px-3 pb-1 sm:mx-0 sm:px-0" aria-label="Pilih tanggal">
          {days.map((d) => {
            const value = toDateValue(d)
            const active = value === dateValue
            return (
              <Link
                key={value}
                href={`/pegawai/kendaraan?tanggal=${value}`}
                scroll={false}
                className={cn(
                  "flex w-14 shrink-0 snap-start flex-col items-center rounded-2xl border py-2 transition-colors",
                  active ? "border-primary bg-primary text-primary-foreground shadow-sm" : "bg-card hover:bg-muted"
                )}
              >
                <span className={cn("text-[11px]", active ? "text-primary-foreground/80" : "text-muted-foreground")}>
                  {value === today ? "Hari ini" : d.toLocaleDateString("id-ID", { weekday: "short" })}
                </span>
                <span className="text-lg font-bold leading-tight">{d.getDate()}</span>
                <span className={cn("text-[10px]", active ? "text-primary-foreground/80" : "text-muted-foreground")}>
                  {d.toLocaleDateString("id-ID", { month: "short" })}
                </span>
              </Link>
            )
          })}
        </nav>

        {vehicles.length ? (
          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {vehicles.map((v) => (
              <VehicleDayCard key={v.id} vehicle={v} dayStart={dayStart} dateValue={dateValue} now={now} />
            ))}
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            Belum ada mobil kantor terdaftar di {employee.workLocation.name}. Hubungi bagian Umum.
          </p>
        )}
      </section>

      {history.length ? (
        <section className="mb-6 grid gap-3">
          <SectionHeading icon={<History className="size-4" />} title="Riwayat" />
          <div className="grid gap-2 md:grid-cols-2">
            {history.map((b) => (
              <MyBookingCard key={b.publicId} booking={toMyBooking(b, now)} compact />
            ))}
          </div>
        </section>
      ) : null}

      {/* Tombol booking menempel di bawah layar HP */}
      <div className="sticky bottom-0 -mx-3 -mb-3 border-t bg-background/90 p-3 backdrop-blur md:hidden">
        <BookButton size="lg" className="w-full" date={dateValue}>
          <CalendarPlus className="size-4" />
          Booking Mobil
        </BookButton>
      </div>
    </BookingLauncherProvider>
  )
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <span className="inline-flex items-baseline gap-1.5 rounded-xl bg-white/10 px-3 py-1.5 backdrop-blur">
      <span className="text-lg font-bold tabular-nums">{value}</span>
      <span className="text-xs text-white/80">{label}</span>
    </span>
  )
}

function SectionHeading({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle?: string }) {
  return (
    <div>
      <h2 className="flex items-center gap-2 text-base font-semibold">
        <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">{icon}</span>
        {title}
      </h2>
      {subtitle ? <p className="mt-0.5 pl-9 text-xs text-muted-foreground capitalize">{subtitle}</p> : null}
    </div>
  )
}

function Legend({ className, label }: { className?: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("size-2.5 rounded-sm", className)} />
      {label}
    </span>
  )
}
