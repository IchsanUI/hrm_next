import type { Prisma, VehicleBookingStatus } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import { MAX_BOOKING_HOURS, MAX_DAYS_AHEAD } from "@/lib/vehicle-booking-labels"

// Aturan Booking Kendaraan (server). Status yang MENGUNCI jadwal mobil/sopir:
// pengajuan yang masih menunggu juga mengunci (siapa cepat dia dapat), supaya
// petugas tidak menerima dua pengajuan bentrok untuk mobil yang sama.
export const ACTIVE_BOOKING_STATUSES: VehicleBookingStatus[] = ["MENUNGGU", "DISETUJUI", "BERJALAN"]

// Pick dari client yang di-extend (lihat lib/prisma.ts) — tipe
// Prisma.TransactionClient bawaan tidak kompatibel dengan tx hasil extension.
type Tx = Pick<typeof prisma, "vehicleBooking" | "$queryRaw">

export function buildBookingNumber(id: number, createdAt: Date) {
  const yy = String(createdAt.getFullYear()).slice(-2)
  const mm = String(createdAt.getMonth() + 1).padStart(2, "0")
  return `KDR-${yy}${mm}-${String(id).padStart(4, "0")}`
}

// "YYYY-MM-DDTHH:mm" dari <input type="datetime-local"> → Date jam lokal
// server (TZ Asia/Jakarta).
export function parseLocalDateTime(value: FormDataEntryValue | null): Date | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export function validateBookingWindow(startAt: Date, endAt: Date, now = new Date()): string | null {
  if (endAt <= startAt) return "Jam selesai harus setelah jam mulai."
  if (startAt.getTime() < now.getTime() - 5 * 60_000) return "Waktu mulai sudah lewat."
  if (endAt.getTime() - startAt.getTime() > MAX_BOOKING_HOURS * 3_600_000) {
    return `Durasi booking maksimal ${MAX_BOOKING_HOURS} jam.`
  }
  if (startAt.getTime() - now.getTime() > MAX_DAYS_AHEAD * 86_400_000) {
    return `Booking paling jauh ${MAX_DAYS_AHEAD} hari ke depan.`
  }
  return null
}

const overlap = (startAt: Date, endAt: Date) => ({ startAt: { lt: endAt }, endAt: { gt: startAt } })

// Kunci baris mobil (SELECT ... FOR UPDATE) supaya dua pengajuan bersamaan
// untuk mobil yang sama diproses berurutan — tanpa ini keduanya bisa lolos
// cek bentrok dan sama-sama tersimpan.
export async function lockVehicle(tx: Tx, vehicleId: number) {
  await tx.$queryRaw`SELECT id FROM vehicles WHERE id = ${vehicleId} FOR UPDATE`
}

export async function findVehicleConflict(
  db: Tx,
  vehicleId: number,
  startAt: Date,
  endAt: Date,
  excludeBookingId?: number
) {
  return db.vehicleBooking.findFirst({
    where: {
      vehicleId,
      status: { in: ACTIVE_BOOKING_STATUSES },
      ...overlap(startAt, endAt),
      ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
    },
    select: { bookingNumber: true, startAt: true, endAt: true },
  })
}

export async function findDriverConflict(
  db: Tx,
  driverId: number,
  startAt: Date,
  endAt: Date,
  excludeBookingId?: number
) {
  return db.vehicleBooking.findFirst({
    where: {
      driverId,
      status: { in: ["DISETUJUI", "BERJALAN"] },
      ...overlap(startAt, endAt),
      ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
    },
    select: { bookingNumber: true },
  })
}

// Mobil di lokasi tertentu + booking aktif yang beririsan dengan rentang —
// dipakai halaman pegawai (timeline) & form booking (cek ketersediaan).
export async function getVehiclesWithBookings(where: Prisma.VehicleWhereInput, rangeStart: Date, rangeEnd: Date) {
  return prisma.vehicle.findMany({
    where: { status: { not: "NONAKTIF" }, ...where },
    orderBy: [{ status: "asc" }, { name: "asc" }],
    include: {
      workLocation: { select: { name: true } },
      bookings: {
        where: { status: { in: ACTIVE_BOOKING_STATUSES }, ...overlap(rangeStart, rangeEnd) },
        orderBy: { startAt: "asc" },
        select: {
          id: true,
          startAt: true,
          endAt: true,
          status: true,
          destination: true,
          requester: { select: { fullName: true } },
        },
      },
    },
  })
}

export async function isVehicleStaff(employeeId: number | null | undefined, role: "PETUGAS" | "SOPIR") {
  if (!employeeId) return false
  const row = await prisma.vehicleStaff.findUnique({ where: { employeeId_role: { employeeId, role } } })
  return !!row
}

// Badge menu Kelola Kendaraan — null = bukan petugas (menu disembunyikan).
export async function getVehicleReviewBadge(employeeId: number | null | undefined): Promise<number | null> {
  if (!(await isVehicleStaff(employeeId, "PETUGAS"))) return null
  return prisma.vehicleBooking.count({ where: { status: "MENUNGGU" } })
}

export function formatTimeRange(startAt: Date, endAt: Date) {
  const sameDay = startAt.toDateString() === endAt.toDateString()
  const time = (d: Date) => d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
  const day = (d: Date) => d.toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short" })
  return sameDay ? `${day(startAt)}, ${time(startAt)}–${time(endAt)}` : `${day(startAt)} ${time(startAt)} – ${day(endAt)} ${time(endAt)}`
}
