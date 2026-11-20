import Link from "next/link"
import { redirect } from "next/navigation"
import { Car } from "lucide-react"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { formatTimeRange } from "@/lib/vehicle-booking"
import { Breadcrumb } from "@/components/breadcrumb"
import { VehicleBookingsTable, VehicleManager, VehicleStaffManager } from "@/components/vehicle/vehicle-admin"
import { cn } from "@/lib/utils"

const TABS = [
  { key: "kendaraan", label: "Kendaraan" },
  { key: "petugas", label: "Petugas & Sopir" },
  { key: "booking", label: "Semua Booking" },
] as const

// Kendaraan Dinas — SUPER_ADMIN atau HR_ADMIN dengan akses "Umum → Kendaraan
// Dinas" (proxy.ts menjaga lewat lib/hr-menu-access.ts).
export default async function AdminKendaraanPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const session = await auth()
  const allowed =
    session?.user.role === "SUPER_ADMIN" || (session?.user.role === "HR_ADMIN" && session.user.menuAccess.includes("umum.kendaraan"))
  if (!allowed) redirect("/admin/dashboard")

  const { tab: rawTab } = await searchParams
  const tab = TABS.some((t) => t.key === rawTab) ? rawTab : "kendaraan"

  return (
    <div>
      <Breadcrumb items={[{ label: "Dashboard", href: "/admin/dashboard" }, { label: "Kendaraan Dinas" }]} />
      <div className="mb-5 flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Car className="size-5" />
        </span>
        <div>
          <h1 className="text-xl font-semibold sm:text-2xl">Kendaraan Dinas</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Data mobil kantor per lokasi, petugas & sopir, serta seluruh booking. Pegawai membooking lewat menu Pinjam Mobil.
          </p>
        </div>
      </div>

      <nav className="-mx-3 mb-5 flex gap-2 overflow-x-auto px-3 pb-1 sm:mx-0 sm:px-0">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/admin/kendaraan?tab=${t.key}`}
            className={cn(
              "shrink-0 rounded-full border px-3.5 py-1.5 text-sm transition-colors",
              tab === t.key ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted"
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {tab === "kendaraan" ? <VehiclesTab /> : null}
      {tab === "petugas" ? <StaffTab /> : null}
      {tab === "booking" ? <BookingsTab /> : null}
    </div>
  )
}

async function VehiclesTab() {
  const [vehicles, locations] = await Promise.all([
    prisma.vehicle.findMany({
      orderBy: [{ workLocationId: "asc" }, { name: "asc" }],
      include: { workLocation: { select: { name: true } }, _count: { select: { bookings: true } } },
    }),
    prisma.workLocation.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ])
  return (
    <VehicleManager
      locations={locations}
      vehicles={vehicles.map((v) => ({
        publicId: v.publicId,
        name: v.name,
        plateNumber: v.plateNumber,
        capacity: v.capacity,
        color: v.color,
        photoUrl: v.photoUrl,
        workLocationId: v.workLocationId,
        workLocationName: v.workLocation.name,
        status: v.status,
        notes: v.notes,
        lastOdometerKm: v.lastOdometerKm,
        bookingCount: v._count.bookings,
      }))}
    />
  )
}

async function StaffTab() {
  const [staff, employees] = await Promise.all([
    prisma.vehicleStaff.findMany({
      include: { employee: { select: { id: true, fullName: true, position: { select: { name: true } } } } },
      orderBy: { employee: { fullName: "asc" } },
    }),
    prisma.employee.findMany({
      where: { isActive: true, isDeleted: false },
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true, position: { select: { name: true } } },
    }),
  ])
  return (
    <VehicleStaffManager
      staff={staff.map((s) => ({ employeeId: s.employee.id, fullName: s.employee.fullName, position: s.employee.position.name, role: s.role }))}
      employees={employees.map((e) => ({ id: e.id, label: `${e.fullName} — ${e.position.name}` }))}
    />
  )
}

async function BookingsTab() {
  const bookings = await prisma.vehicleBooking.findMany({
    orderBy: { startAt: "desc" },
    take: 500,
    include: {
      vehicle: { select: { name: true, plateNumber: true } },
      requester: { select: { fullName: true } },
      driver: { select: { fullName: true } },
    },
  })
  return (
    <VehicleBookingsTable
      rows={bookings.map((b) => ({
        bookingNumber: b.bookingNumber,
        requester: b.requester.fullName,
        vehicle: `${b.vehicle.name} · ${b.vehicle.plateNumber}`,
        when: formatTimeRange(b.startAt, b.endAt),
        destination: b.destination,
        driver: b.driver?.fullName ?? (b.needsDriver ? "Diminta" : "Menyetir sendiri"),
        status: b.status,
      }))}
    />
  )
}
