import Link from "next/link"
import { redirect } from "next/navigation"
import { connection } from "next/server"
import { ClipboardList } from "lucide-react"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { formatTimeRange, isVehicleStaff } from "@/lib/vehicle-booking"
import { Breadcrumb } from "@/components/breadcrumb"
import { PetugasBookingCard, type PetugasBooking } from "@/components/vehicle/petugas-booking-card"
import { cn } from "@/lib/utils"

const TABS = [
  { key: "menunggu", label: "Perlu Persetujuan" },
  { key: "hari-ini", label: "Serah-Terima Hari Ini" },
  { key: "mendatang", label: "Jadwal Mendatang" },
  { key: "riwayat", label: "Riwayat" },
] as const
type TabKey = (typeof TABS)[number]["key"]

// Kelola Booking Kendaraan — khusus Petugas Umum (VehicleStaff PETUGAS).
export default async function KelolaKendaraanPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await connection()
  const session = await auth()
  const employeeId = session?.user.employeeId
  if (!employeeId || !(await isVehicleStaff(employeeId, "PETUGAS"))) redirect("/pegawai/kendaraan")

  const { tab: rawTab } = await searchParams
  const tab: TabKey = TABS.some((t) => t.key === rawTab) ? (rawTab as TabKey) : "menunggu"

  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const tomorrow = new Date(todayStart.getTime() + 86_400_000)

  const where = {
    menunggu: { status: "MENUNGGU" as const },
    // Kunci yang harus diserahkan/diterima hari ini + yang terlambat kembali.
    "hari-ini": {
      OR: [
        { status: "DISETUJUI" as const, startAt: { lt: tomorrow } },
        { status: "BERJALAN" as const },
      ],
    },
    mendatang: { status: "DISETUJUI" as const, startAt: { gte: tomorrow } },
    riwayat: { status: { in: ["SELESAI", "DITOLAK", "DIBATALKAN"] as ("SELESAI" | "DITOLAK" | "DIBATALKAN")[] } },
  }

  const [rows, counts] = await Promise.all([
    prisma.vehicleBooking.findMany({
      where: where[tab],
      orderBy: { startAt: tab === "riwayat" ? "desc" : "asc" },
      take: tab === "riwayat" ? 40 : 100,
      include: {
        vehicle: { select: { id: true, name: true, plateNumber: true, photoUrl: true, lastOdometerKm: true } },
        requester: { select: { fullName: true, position: { select: { name: true } } } },
        driver: { select: { fullName: true } },
      },
    }),
    Promise.all(TABS.map((t) => (t.key === "riwayat" ? Promise.resolve(null) : prisma.vehicleBooking.count({ where: where[t.key] })))),
  ])

  const bookings: PetugasBooking[] = rows.map((b) => ({
    publicId: b.publicId,
    bookingNumber: b.bookingNumber,
    status: b.status,
    whenLabel: formatTimeRange(b.startAt, b.endAt),
    requesterName: b.requester.fullName,
    requesterPosition: b.requester.position.name,
    destination: b.destination,
    purpose: b.purpose,
    passengerCount: b.passengerCount,
    needsDriver: b.needsDriver,
    driverName: b.driver?.fullName ?? null,
    vehicleId: b.vehicle.id,
    vehicleName: b.vehicle.name,
    plateNumber: b.vehicle.plateNumber,
    photoUrl: b.vehicle.photoUrl,
    lastOdometerKm: b.vehicle.lastOdometerKm,
    startKm: b.startKm,
    overdue: b.status === "BERJALAN" && b.endAt < now,
    note:
      b.status === "DITOLAK"
        ? `Ditolak: ${b.rejectionReason ?? "-"}`
        : b.status === "DIBATALKAN"
          ? `Dibatalkan${b.cancelReason ? `: ${b.cancelReason}` : " oleh pemohon"}`
          : b.status === "SELESAI"
            ? `KM ${b.startKm ?? "-"} → ${b.endKm ?? "-"}${b.returnNote ? ` · ${b.returnNote}` : ""}`
            : null,
  }))

  return (
    <div>
      <Breadcrumb items={[{ label: "Dashboard", href: "/pegawai/dashboard" }, { label: "Kelola Booking Kendaraan" }]} />
      <div className="mb-5 flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <ClipboardList className="size-5" />
        </span>
        <div>
          <h1 className="text-xl font-semibold sm:text-2xl">Kelola Booking Kendaraan</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Setujui pengajuan, tugaskan sopir, dan catat serah-terima kunci (KM awal & akhir).
          </p>
        </div>
      </div>

      <nav className="-mx-3 mb-5 flex gap-2 overflow-x-auto px-3 pb-1 sm:mx-0 sm:px-0" aria-label="Filter booking">
        {TABS.map((t, i) => (
          <Link
            key={t.key}
            href={`/pegawai/kelola-kendaraan?tab=${t.key}`}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm transition-colors",
              tab === t.key ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted"
            )}
          >
            {t.label}
            {counts[i] ? (
              <span
                className={cn(
                  "rounded-full px-1.5 text-xs font-semibold tabular-nums",
                  tab === t.key ? "bg-white/20" : "bg-primary/10 text-primary"
                )}
              >
                {counts[i]}
              </span>
            ) : null}
          </Link>
        ))}
      </nav>

      {bookings.length ? (
        <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {bookings.map((b) => (
            <PetugasBookingCard key={b.publicId} booking={b} />
          ))}
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          {tab === "menunggu" ? "Tidak ada pengajuan yang menunggu. 👍" : "Belum ada data."}
        </p>
      )}
    </div>
  )
}
