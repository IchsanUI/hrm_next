"use server"

import { randomBytes } from "crypto"
import { revalidatePath } from "next/cache"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity-log"
import { createNotification } from "@/lib/notifications"
import {
  ACTIVE_BOOKING_STATUSES,
  buildBookingNumber,
  findDriverConflict,
  findVehicleConflict,
  formatTimeRange,
  isVehicleStaff,
  lockVehicle,
  parseLocalDateTime,
  validateBookingWindow,
} from "@/lib/vehicle-booking"
import { MAX_ODOMETER_KM } from "@/lib/vehicle-booking-labels"

export type VehicleActionState = { error?: string; success?: boolean; message?: string } | undefined

export type VehicleAvailability = {
  id: number
  name: string
  plateNumber: string
  capacity: number
  color: string | null
  photoUrl: string | null
  available: boolean
  reason: string | null
}

const PAGES = ["/pegawai/kendaraan", "/pegawai/kelola-kendaraan", "/admin/kendaraan"]
function revalidateAll() {
  for (const p of PAGES) revalidatePath(p)
}

async function requireEmployee() {
  const session = await auth()
  const employeeId = session?.user.employeeId
  if (!session?.user || !employeeId) return null
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { id: true, fullName: true, workLocationId: true, user: { select: { id: true } } },
  })
  if (!employee) return null
  return { session, employee }
}

async function requirePetugas() {
  const ctx = await requireEmployee()
  if (!ctx || !(await isVehicleStaff(ctx.employee.id, "PETUGAS"))) return null
  return ctx
}

async function notifyEmployee(employeeId: number | null | undefined, title: string, message: string, link: string) {
  if (!employeeId) return
  const user = await prisma.user.findUnique({ where: { employeeId }, select: { id: true, isActive: true } })
  if (user?.isActive) await createNotification({ userId: user.id, title, message, link })
}

// ---- Pegawai ---------------------------------------------------------------

// Ketersediaan semua mobil di lokasi kerja pegawai untuk rentang waktu yang
// sedang diisi di form booking (dipanggil saat jam diubah).
export async function checkVehicleAvailabilityAction(startValue: string, endValue: string): Promise<VehicleAvailability[]> {
  const ctx = await requireEmployee()
  if (!ctx) return []
  const startAt = parseLocalDateTime(startValue)
  const endAt = parseLocalDateTime(endValue)

  const vehicles = await prisma.vehicle.findMany({
    where: { workLocationId: ctx.employee.workLocationId, status: { not: "NONAKTIF" } },
    orderBy: { name: "asc" },
    select: { id: true, name: true, plateNumber: true, capacity: true, color: true, photoUrl: true, status: true },
  })
  const valid = startAt && endAt && endAt > startAt
  const conflicts = valid
    ? await prisma.vehicleBooking.findMany({
        where: {
          vehicleId: { in: vehicles.map((v) => v.id) },
          status: { in: ACTIVE_BOOKING_STATUSES },
          startAt: { lt: endAt },
          endAt: { gt: startAt },
        },
        select: { vehicleId: true, startAt: true, endAt: true },
      })
    : []

  return vehicles.map(({ status, ...v }) => {
    const conflict = conflicts.find((c) => c.vehicleId === v.id)
    const reason =
      status === "SERVIS"
        ? "Sedang servis"
        : conflict
          ? `Terpakai ${formatTimeRange(conflict.startAt, conflict.endAt)}`
          : null
    return { ...v, available: !!valid && !reason, reason: valid ? reason : "Isi jam dulu" }
  })
}

export async function createVehicleBookingAction(_prev: VehicleActionState, formData: FormData): Promise<VehicleActionState> {
  const ctx = await requireEmployee()
  if (!ctx) return { error: "Akun Anda tidak terhubung ke data pegawai." }
  const { session, employee } = ctx

  const vehicleId = Number(formData.get("vehicleId"))
  const startAt = parseLocalDateTime(formData.get("startAt"))
  const endAt = parseLocalDateTime(formData.get("endAt"))
  const destination = String(formData.get("destination") ?? "").trim()
  const purpose = String(formData.get("purpose") ?? "").trim()
  const passengerCount = Number(formData.get("passengerCount") ?? 1)
  const needsDriver = formData.get("needsDriver") === "on"

  if (!startAt || !endAt) return { error: "Isi tanggal & jam mulai dan selesai." }
  const windowError = validateBookingWindow(startAt, endAt)
  if (windowError) return { error: windowError }
  if (!vehicleId) return { error: "Pilih mobil yang tersedia." }
  if (destination.length < 3 || destination.length > 200) return { error: "Isi tujuan (3–200 karakter)." }
  if (purpose.length < 5 || purpose.length > 1000) return { error: "Jelaskan keperluan (5–1000 karakter)." }
  if (!Number.isInteger(passengerCount) || passengerCount < 1) return { error: "Jumlah penumpang minimal 1." }

  const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } })
  if (!vehicle || vehicle.workLocationId !== employee.workLocationId) return { error: "Mobil tidak ditemukan di lokasi Anda." }
  if (vehicle.status !== "TERSEDIA") return { error: `${vehicle.name} sedang tidak bisa dibooking.` }
  const seats = vehicle.capacity - (needsDriver ? 1 : 0)
  if (passengerCount > seats) {
    return { error: `${vehicle.name} muat maksimal ${seats} penumpang${needsDriver ? " (1 kursi untuk sopir)" : ""}.` }
  }

  const result = await prisma.$transaction(async (tx) => {
    await lockVehicle(tx, vehicle.id)
    const conflict = await findVehicleConflict(tx, vehicle.id, startAt, endAt)
    if (conflict) return { conflict }
    const created = await tx.vehicleBooking.create({
      data: {
        bookingNumber: `TMP-${randomBytes(6).toString("hex")}`,
        vehicleId: vehicle.id,
        requesterId: employee.id,
        startAt,
        endAt,
        destination,
        purpose,
        passengerCount,
        needsDriver,
      },
    })
    const booking = await tx.vehicleBooking.update({
      where: { id: created.id },
      data: { bookingNumber: buildBookingNumber(created.id, created.createdAt) },
    })
    return { booking }
  })
  if ("conflict" in result && result.conflict) {
    return { error: `${vehicle.name} sudah dibooking pada ${formatTimeRange(result.conflict.startAt, result.conflict.endAt)}. Pilih jam atau mobil lain.` }
  }
  const booking = result.booking!

  await logActivity({
    userId: Number(session.user.id),
    username: session.user.username,
    action: "CREATE",
    entityType: "VehicleBooking",
    description: `${session.user.username} membooking ${vehicle.name} (${vehicle.plateNumber}) ${formatTimeRange(startAt, endAt)} — ${booking.bookingNumber}.`,
  })

  const petugas = await prisma.vehicleStaff.findMany({ where: { role: "PETUGAS" }, select: { employeeId: true } })
  await Promise.all(
    petugas
      .filter((p) => p.employeeId !== employee.id)
      .map((p) =>
        notifyEmployee(
          p.employeeId,
          "Booking Mobil Baru",
          `${employee.fullName}: ${vehicle.name}, ${formatTimeRange(startAt, endAt)} ke ${destination}.`,
          "/pegawai/kelola-kendaraan"
        )
      )
  )

  revalidateAll()
  return { success: true, message: `Booking ${booking.bookingNumber} terkirim. Menunggu persetujuan petugas.` }
}

// Pemohon membatalkan sendiri (sebelum berangkat) ATAU petugas membatalkan.
export async function cancelVehicleBookingAction(publicId: string, reason: string): Promise<VehicleActionState> {
  const ctx = await requireEmployee()
  if (!ctx) return { error: "Sesi tidak valid." }
  const booking = await prisma.vehicleBooking.findUnique({ where: { publicId }, include: { vehicle: true } })
  if (!booking) return { error: "Booking tidak ditemukan." }

  const isOwner = booking.requesterId === ctx.employee.id
  const isPetugas = await isVehicleStaff(ctx.employee.id, "PETUGAS")
  if (!isOwner && !isPetugas) return { error: "Anda tidak berwenang membatalkan booking ini." }
  if (booking.status !== "MENUNGGU" && booking.status !== "DISETUJUI") {
    return { error: "Booking ini sudah tidak bisa dibatalkan." }
  }
  const cleanReason = reason.trim().slice(0, 500)
  if (!isOwner && cleanReason.length < 3) return { error: "Isi alasan pembatalan." }

  await prisma.vehicleBooking.update({
    where: { id: booking.id },
    data: { status: "DIBATALKAN", cancelReason: cleanReason || null },
  })
  await logActivity({
    userId: Number(ctx.session.user.id),
    username: ctx.session.user.username,
    action: "UPDATE",
    entityType: "VehicleBooking",
    description: `${ctx.session.user.username} membatalkan booking ${booking.bookingNumber}${cleanReason ? `: ${cleanReason}` : ""}.`,
  })
  if (!isOwner) {
    await notifyEmployee(
      booking.requesterId,
      "Booking Mobil Dibatalkan",
      `${booking.bookingNumber} (${booking.vehicle.name}) dibatalkan petugas: ${cleanReason}`,
      "/pegawai/kendaraan"
    )
  }
  if (booking.driverId) {
    await notifyEmployee(
      booking.driverId,
      "Tugas Menyopir Dibatalkan",
      `${booking.bookingNumber} — ${formatTimeRange(booking.startAt, booking.endAt)} dibatalkan.`,
      "/pegawai/kendaraan"
    )
  }
  revalidateAll()
  return { success: true, message: "Booking dibatalkan." }
}

// ---- Petugas -----------------------------------------------------------------

export async function approveVehicleBookingAction(
  publicId: string,
  _prev: VehicleActionState,
  formData: FormData
): Promise<VehicleActionState> {
  const ctx = await requirePetugas()
  if (!ctx) return { error: "Hanya petugas kendaraan yang bisa menyetujui." }
  const booking = await prisma.vehicleBooking.findUnique({ where: { publicId }, include: { requester: { select: { fullName: true } } } })
  if (!booking || booking.status !== "MENUNGGU") return { error: "Booking tidak dalam status menunggu." }

  const vehicleId = Number(formData.get("vehicleId") || booking.vehicleId)
  // "self" = pemohon menyetir sendiri (tanpa sopir), walau tadinya minta sopir.
  const rawDriver = String(formData.get("driverId") ?? "")
  const selfDrive = rawDriver === "self"
  const driverId = rawDriver && !selfDrive ? Number(rawDriver) : null
  const note = String(formData.get("note") ?? "").trim().slice(0, 500) || null
  if (booking.needsDriver && !driverId && !selfDrive) {
    return { error: "Pemohon meminta sopir — pilih sopir atau \"Menyetir sendiri\"." }
  }

  const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } })
  if (!vehicle || vehicle.status !== "TERSEDIA") return { error: "Mobil tidak tersedia." }
  if (driverId && !(await isVehicleStaff(driverId, "SOPIR"))) return { error: "Sopir tidak terdaftar." }

  const result = await prisma.$transaction(async (tx) => {
    await lockVehicle(tx, vehicle.id)
    const conflict = await findVehicleConflict(tx, vehicle.id, booking.startAt, booking.endAt, booking.id)
    if (conflict) return { error: `${vehicle.name} bentrok dengan ${conflict.bookingNumber}.` }
    if (driverId) {
      const driverConflict = await findDriverConflict(tx, driverId, booking.startAt, booking.endAt, booking.id)
      if (driverConflict) return { error: `Sopir sudah bertugas di ${driverConflict.bookingNumber} pada jam itu.` }
    }
    await tx.vehicleBooking.update({
      where: { id: booking.id },
      data: {
        status: "DISETUJUI",
        vehicleId: vehicle.id,
        driverId,
        needsDriver: driverId !== null,
        handledById: ctx.employee.id,
        handledAt: new Date(),
        handlerNote: note,
      },
    })
    return { ok: true }
  })
  if ("error" in result) return { error: result.error }

  const when = formatTimeRange(booking.startAt, booking.endAt)
  await logActivity({
    userId: Number(ctx.session.user.id),
    username: ctx.session.user.username,
    action: "UPDATE",
    entityType: "VehicleBooking",
    description: `${ctx.session.user.username} menyetujui booking ${booking.bookingNumber} (${vehicle.name}${driverId ? ", dengan sopir" : ", menyetir sendiri"}).`,
  })
  await notifyEmployee(
    booking.requesterId,
    "Booking Mobil Disetujui",
    `${booking.bookingNumber}: ${vehicle.name} (${vehicle.plateNumber}), ${when}.${vehicle.id !== booking.vehicleId ? " Mobil diganti petugas." : ""}${booking.needsDriver && selfDrive ? " Tanpa sopir — Anda menyetir sendiri." : ""}${note ? ` Catatan: ${note}` : ""}`,
    "/pegawai/kendaraan"
  )
  if (driverId) {
    await notifyEmployee(
      driverId,
      "Tugas Menyopir",
      `${when} — ${vehicle.name} (${vehicle.plateNumber}) untuk ${booking.requester.fullName}, tujuan ${booking.destination}.`,
      "/pegawai/kendaraan"
    )
  }
  revalidateAll()
  return { success: true, message: "Booking disetujui." }
}

export async function rejectVehicleBookingAction(
  publicId: string,
  _prev: VehicleActionState,
  formData: FormData
): Promise<VehicleActionState> {
  const ctx = await requirePetugas()
  if (!ctx) return { error: "Hanya petugas kendaraan yang bisa menolak." }
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 500)
  if (reason.length < 3) return { error: "Isi alasan penolakan." }
  const booking = await prisma.vehicleBooking.findUnique({ where: { publicId }, include: { vehicle: true } })
  if (!booking || booking.status !== "MENUNGGU") return { error: "Booking tidak dalam status menunggu." }

  await prisma.vehicleBooking.update({
    where: { id: booking.id },
    data: { status: "DITOLAK", rejectionReason: reason, handledById: ctx.employee.id, handledAt: new Date() },
  })
  await logActivity({
    userId: Number(ctx.session.user.id),
    username: ctx.session.user.username,
    action: "UPDATE",
    entityType: "VehicleBooking",
    description: `${ctx.session.user.username} menolak booking ${booking.bookingNumber}: ${reason}`,
  })
  await notifyEmployee(
    booking.requesterId,
    "Booking Mobil Ditolak",
    `${booking.bookingNumber} (${booking.vehicle.name}) ditolak: ${reason}`,
    "/pegawai/kendaraan"
  )
  revalidateAll()
  return { success: true, message: "Booking ditolak." }
}

// Serah-terima kunci: berangkat (KM awal) & kembali (KM akhir + kondisi).
export async function departVehicleBookingAction(
  publicId: string,
  _prev: VehicleActionState,
  formData: FormData
): Promise<VehicleActionState> {
  const ctx = await requirePetugas()
  if (!ctx) return { error: "Hanya petugas kendaraan yang bisa mencatat serah-terima." }
  const startKm = Number(formData.get("startKm"))
  if (!Number.isInteger(startKm) || startKm < 0 || startKm > MAX_ODOMETER_KM) {
    return { error: `KM awal harus angka 0–${MAX_ODOMETER_KM.toLocaleString("id-ID")}.` }
  }
  const booking = await prisma.vehicleBooking.findUnique({ where: { publicId } })
  if (!booking || booking.status !== "DISETUJUI") return { error: "Booking belum disetujui atau sudah berjalan." }

  await prisma.vehicleBooking.update({
    where: { id: booking.id },
    data: { status: "BERJALAN", departedAt: new Date(), startKm },
  })
  await logActivity({
    userId: Number(ctx.session.user.id),
    username: ctx.session.user.username,
    action: "UPDATE",
    entityType: "VehicleBooking",
    description: `${ctx.session.user.username} mencatat keberangkatan ${booking.bookingNumber} (KM awal ${startKm}).`,
  })
  revalidateAll()
  return { success: true, message: "Keberangkatan dicatat." }
}

export async function returnVehicleBookingAction(
  publicId: string,
  _prev: VehicleActionState,
  formData: FormData
): Promise<VehicleActionState> {
  const ctx = await requirePetugas()
  if (!ctx) return { error: "Hanya petugas kendaraan yang bisa mencatat serah-terima." }
  const endKm = Number(formData.get("endKm"))
  const note = String(formData.get("returnNote") ?? "").trim().slice(0, 1000) || null
  const booking = await prisma.vehicleBooking.findUnique({ where: { publicId } })
  if (!booking || booking.status !== "BERJALAN") return { error: "Booking tidak sedang berjalan." }
  if (!Number.isInteger(endKm) || endKm < (booking.startKm ?? 0) || endKm > MAX_ODOMETER_KM) {
    return { error: `KM akhir harus angka dan tidak kurang dari KM awal (${booking.startKm ?? 0}).` }
  }

  await prisma.$transaction([
    prisma.vehicleBooking.update({
      where: { id: booking.id },
      data: { status: "SELESAI", returnedAt: new Date(), endKm, returnNote: note },
    }),
    prisma.vehicle.update({ where: { id: booking.vehicleId }, data: { lastOdometerKm: endKm } }),
  ])
  await logActivity({
    userId: Number(ctx.session.user.id),
    username: ctx.session.user.username,
    action: "UPDATE",
    entityType: "VehicleBooking",
    description: `${ctx.session.user.username} mencatat pengembalian ${booking.bookingNumber} (KM akhir ${endKm}, ${endKm - (booking.startKm ?? endKm)} km)${note ? `: ${note}` : ""}.`,
  })
  revalidateAll()
  return { success: true, message: "Pengembalian dicatat." }
}

// Ketersediaan mobil & sopir untuk dialog persetujuan petugas.
export async function getApprovalOptionsAction(publicId: string) {
  const ctx = await requirePetugas()
  if (!ctx) return null
  const booking = await prisma.vehicleBooking.findUnique({ where: { publicId } })
  if (!booking) return null

  const [vehicles, drivers] = await Promise.all([
    prisma.vehicle.findMany({
      where: { status: "TERSEDIA" },
      orderBy: [{ workLocationId: "asc" }, { name: "asc" }],
      select: { id: true, name: true, plateNumber: true, workLocation: { select: { name: true } } },
    }),
    prisma.vehicleStaff.findMany({
      where: { role: "SOPIR", employee: { isActive: true, isDeleted: false } },
      select: { employee: { select: { id: true, fullName: true } } },
    }),
  ])
  const vehicleOptions = await Promise.all(
    vehicles.map(async (v) => ({
      id: v.id,
      label: `${v.name} · ${v.plateNumber} (${v.workLocation.name})`,
      conflict: (await findVehicleConflict(prisma, v.id, booking.startAt, booking.endAt, booking.id))?.bookingNumber ?? null,
    }))
  )
  const driverOptions = await Promise.all(
    drivers.map(async (d) => ({
      id: d.employee.id,
      label: d.employee.fullName,
      conflict: (await findDriverConflict(prisma, d.employee.id, booking.startAt, booking.endAt, booking.id))?.bookingNumber ?? null,
    }))
  )
  return { vehicleOptions, driverOptions }
}
