"use server"

import { revalidatePath } from "next/cache"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity-log"
import { attendanceDeviceSchema } from "@/lib/validations/master-data"
import { testDeviceConnection } from "@/lib/attendance/scraper"
import { syncAllDevices, type DeviceSyncResult } from "@/lib/attendance/sync"

export type AttendanceFormState = { error?: string; success?: boolean } | undefined

async function logAttendance(action: string, description: string) {
  const session = await auth()
  await logActivity({
    userId: session?.user.id ? Number(session.user.id) : null,
    username: session?.user.username ?? "system",
    action,
    entityType: "AttendanceDevice",
    description,
  })
}

export async function createAttendanceDeviceAction(
  _prevState: AttendanceFormState,
  formData: FormData
): Promise<AttendanceFormState> {
  const parsed = attendanceDeviceSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Data tidak valid." }
  }
  const existing = await prisma.attendanceDevice.findUnique({ where: { name: parsed.data.name } })
  if (existing) {
    return { error: "Nama lokasi/mesin ini sudah dipakai." }
  }
  await prisma.attendanceDevice.create({ data: parsed.data })
  await logAttendance("CREATE", `Menambahkan mesin absensi "${parsed.data.name}" (${parsed.data.ip}).`)
  revalidatePath("/admin/absensi/pengaturan")
  return { success: true }
}

export async function updateAttendanceDeviceAction(
  id: number,
  _prevState: AttendanceFormState,
  formData: FormData
): Promise<AttendanceFormState> {
  const parsed = attendanceDeviceSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Data tidak valid." }
  }
  const duplicate = await prisma.attendanceDevice.findFirst({
    where: { name: parsed.data.name, NOT: { id } },
  })
  if (duplicate) {
    return { error: "Nama lokasi/mesin ini sudah dipakai." }
  }
  await prisma.attendanceDevice.update({ where: { id }, data: parsed.data })
  await logAttendance("UPDATE", `Memperbarui mesin absensi "${parsed.data.name}" (${parsed.data.ip}).`)
  revalidatePath("/admin/absensi/pengaturan")
  return { success: true }
}

export async function deleteAttendanceDeviceAction(id: number) {
  const device = await prisma.attendanceDevice.findUnique({ where: { id } })
  await prisma.attendanceDevice.delete({ where: { id } })
  if (device) {
    await logAttendance("DELETE", `Menghapus mesin absensi "${device.name}".`)
  }
  revalidatePath("/admin/absensi/pengaturan")
}

export type TestConnectionState = { ok: boolean; message: string } | undefined

export async function testAttendanceDeviceConnectionAction(
  _prevState: TestConnectionState,
  formData: FormData
): Promise<TestConnectionState> {
  const ip = String(formData.get("ip") ?? "")
  const loginUser = String(formData.get("loginUser") ?? "")
  const loginPass = String(formData.get("loginPass") ?? "")
  if (!ip || !loginUser || !loginPass) {
    return { ok: false, message: "IP, username, dan password wajib diisi dulu." }
  }
  return testDeviceConnection(ip, loginUser, loginPass)
}

export async function updateAttendancePollSecondsAction(
  _prevState: AttendanceFormState,
  formData: FormData
): Promise<AttendanceFormState> {
  const pollSeconds = Number(formData.get("pollSeconds"))
  if (!Number.isFinite(pollSeconds) || pollSeconds < 5) {
    return { error: "Interval polling minimal 5 detik." }
  }
  await prisma.attendanceSettings.upsert({
    where: { id: 1 },
    create: { id: 1, pollSeconds },
    update: { pollSeconds },
  })
  await logAttendance("UPDATE", `Mengubah interval polling absensi jadi ${pollSeconds} detik.`)
  revalidatePath("/admin/absensi/pengaturan")
  return { success: true }
}

export type SyncAttendanceState =
  | { error: string; results?: undefined }
  | { error?: undefined; results: DeviceSyncResult[] }
  | undefined

// Trigger "Ambil Data Mesin" — sdate/edate kosong = ambil data hari ini saja.
export async function syncAttendanceAction(
  _prevState: SyncAttendanceState,
  formData: FormData
): Promise<SyncAttendanceState> {
  const sdate = String(formData.get("sdate") ?? "").trim() || undefined
  const edate = String(formData.get("edate") ?? "").trim() || undefined

  const devices = await prisma.attendanceDevice.count({ where: { active: true } })
  if (devices === 0) {
    return { error: "Belum ada mesin absensi aktif. Tambahkan dulu di Pengaturan Absensi." }
  }

  const results = await syncAllDevices(sdate, edate)
  const totalSaved = results.reduce((sum, r) => sum + r.saved, 0)
  await logAttendance(
    "DOWNLOAD",
    `Mengambil data absensi manual (${sdate ?? "hari ini"} s/d ${edate ?? "hari ini"}) — ${totalSaved} record baru dari ${results.length} mesin.`
  )
  revalidatePath("/admin/absensi/data")
  return { results }
}
