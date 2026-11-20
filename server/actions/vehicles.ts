"use server"

import { mkdir, writeFile } from "fs/promises"
import path from "path"

import { Prisma } from "@prisma/client"
import sharp from "sharp"
import { revalidatePath } from "next/cache"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity-log"

export type VehicleFormState = { error?: string; success?: boolean } | undefined

// Kelola data kendaraan & petugas/sopir — SUPER_ADMIN, atau HR_ADMIN yang
// diberi akses menu "Umum → Kendaraan Dinas".
async function requireVehicleAdmin() {
  const session = await auth()
  if (!session?.user) return null
  const ok = session.user.role === "SUPER_ADMIN" || (session.user.role === "HR_ADMIN" && session.user.menuAccess.includes("umum.kendaraan"))
  return ok ? session : null
}

function revalidateAll() {
  revalidatePath("/admin/kendaraan")
  revalidatePath("/pegawai/kendaraan")
  revalidatePath("/pegawai/kelola-kendaraan")
}

async function saveVehiclePhoto(file: FormDataEntryValue | null): Promise<string | null | { error: string }> {
  if (!(file instanceof File) || file.size === 0) return null
  if (!file.type.startsWith("image/")) return { error: "Foto harus berupa gambar." }
  if (file.size > 5 * 1024 * 1024) return { error: "Ukuran foto maksimal 5 MB." }
  try {
    const buffer = await sharp(Buffer.from(await file.arrayBuffer()))
      .rotate()
      .resize(960, 600, { fit: "cover" })
      .jpeg({ quality: 82 })
      .toBuffer()
    const dir = path.join(process.cwd(), "public", "uploads", "kendaraan")
    await mkdir(dir, { recursive: true })
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`
    await writeFile(path.join(dir, fileName), buffer)
    return `/uploads/kendaraan/${fileName}`
  } catch {
    return { error: "File foto tidak bisa dibaca." }
  }
}

export async function saveVehicleAction(_prev: VehicleFormState, formData: FormData): Promise<VehicleFormState> {
  const session = await requireVehicleAdmin()
  if (!session) return { error: "Anda tidak berwenang mengelola kendaraan." }

  const publicId = String(formData.get("publicId") ?? "") || null
  const name = String(formData.get("name") ?? "").trim()
  const plateNumber = String(formData.get("plateNumber") ?? "").trim().toUpperCase().replace(/\s+/g, " ")
  const capacity = Number(formData.get("capacity"))
  const color = String(formData.get("color") ?? "").trim() || null
  const workLocationId = Number(formData.get("workLocationId"))
  const status = String(formData.get("status") ?? "TERSEDIA")
  const notes = String(formData.get("notes") ?? "").trim() || null

  if (name.length < 2 || name.length > 100) return { error: "Isi nama/tipe mobil." }
  if (plateNumber.length < 3 || plateNumber.length > 20) return { error: "Isi plat nomor." }
  if (!Number.isInteger(capacity) || capacity < 2 || capacity > 60) return { error: "Kapasitas 2–60 kursi." }
  if (!workLocationId) return { error: "Pilih lokasi kerja." }
  if (!["TERSEDIA", "SERVIS", "NONAKTIF"].includes(status)) return { error: "Status tidak valid." }

  const photo = await saveVehiclePhoto(formData.get("photo"))
  if (photo && typeof photo === "object") return { error: photo.error }

  const data = {
    name,
    plateNumber,
    capacity,
    color,
    workLocationId,
    status: status as "TERSEDIA" | "SERVIS" | "NONAKTIF",
    notes,
    ...(photo ? { photoUrl: photo } : {}),
  }
  try {
    if (publicId) await prisma.vehicle.update({ where: { publicId }, data })
    else await prisma.vehicle.create({ data })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { error: "Plat nomor sudah terdaftar." }
    }
    throw err
  }

  await logActivity({
    userId: Number(session.user.id),
    username: session.user.username,
    action: publicId ? "UPDATE" : "CREATE",
    entityType: "Vehicle",
    description: `${session.user.username} ${publicId ? "memperbarui" : "menambahkan"} kendaraan ${name} (${plateNumber}).`,
  })
  revalidateAll()
  return { success: true }
}

export async function deleteVehicleAction(publicId: string): Promise<VehicleFormState> {
  const session = await requireVehicleAdmin()
  if (!session) return { error: "Anda tidak berwenang mengelola kendaraan." }
  const vehicle = await prisma.vehicle.findUnique({ where: { publicId }, include: { _count: { select: { bookings: true } } } })
  if (!vehicle) return { error: "Kendaraan tidak ditemukan." }
  if (vehicle._count.bookings > 0) {
    return { error: "Kendaraan sudah punya riwayat booking — ubah statusnya menjadi Nonaktif saja." }
  }
  await prisma.vehicle.delete({ where: { id: vehicle.id } })
  await logActivity({
    userId: Number(session.user.id),
    username: session.user.username,
    action: "DELETE",
    entityType: "Vehicle",
    description: `${session.user.username} menghapus kendaraan ${vehicle.name} (${vehicle.plateNumber}).`,
  })
  revalidateAll()
  return { success: true }
}

export async function setVehicleStaffAction(employeeId: number, role: "PETUGAS" | "SOPIR", enabled: boolean): Promise<VehicleFormState> {
  const session = await requireVehicleAdmin()
  if (!session) return { error: "Anda tidak berwenang mengelola petugas." }
  if (role !== "PETUGAS" && role !== "SOPIR") return { error: "Peran tidak valid." }
  const employee = await prisma.employee.findUnique({ where: { id: employeeId }, select: { fullName: true } })
  if (!employee) return { error: "Pegawai tidak ditemukan." }

  if (enabled) {
    await prisma.vehicleStaff.upsert({
      where: { employeeId_role: { employeeId, role } },
      update: {},
      create: { employeeId, role },
    })
  } else {
    await prisma.vehicleStaff.deleteMany({ where: { employeeId, role } })
  }
  await logActivity({
    userId: Number(session.user.id),
    username: session.user.username,
    action: "UPDATE",
    entityType: "VehicleStaff",
    description: `${session.user.username} ${enabled ? "menunjuk" : "mencabut"} ${employee.fullName} sebagai ${role === "PETUGAS" ? "petugas kendaraan" : "sopir"}.`,
  })
  revalidateAll()
  return { success: true }
}
