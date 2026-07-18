"use server"

import { Prisma } from "@prisma/client"
import { revalidatePath } from "next/cache"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity-log"
import { workLocationSchema } from "@/lib/validations/master-data"

export type MasterDataState = { error?: string; success?: boolean } | undefined

function parseCoordinate(value: number | "" | undefined) {
  return value === "" || value === undefined ? null : value
}

async function logWorkLocation(action: string, name: string) {
  const session = await auth()
  await logActivity({
    userId: session?.user.id ? Number(session.user.id) : null,
    username: session?.user.username ?? "system",
    action,
    entityType: "WorkLocation",
    description: `${session?.user.username ?? "system"} ${
      action === "CREATE" ? "menambahkan" : action === "UPDATE" ? "memperbarui" : "menghapus"
    } lokasi kerja "${name}".`,
  })
}

export async function createWorkLocationAction(
  _prevState: MasterDataState,
  formData: FormData
): Promise<MasterDataState> {
  const parsed = workLocationSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: "Periksa kembali data yang diisi." }
  }
  try {
    await prisma.workLocation.create({
      data: {
        name: parsed.data.name,
        address: parsed.data.address || null,
        latitude: parseCoordinate(parsed.data.latitude),
        longitude: parseCoordinate(parsed.data.longitude),
        geofenceRadius: parsed.data.geofenceRadius,
      },
    })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { error: "Lokasi kerja dengan nama tersebut sudah ada." }
    }
    throw err
  }
  await logWorkLocation("CREATE", parsed.data.name)
  revalidatePath("/admin/lokasi-kerja")
  return { success: true }
}

export async function updateWorkLocationAction(
  id: number,
  _prevState: MasterDataState,
  formData: FormData
): Promise<MasterDataState> {
  const parsed = workLocationSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: "Periksa kembali data yang diisi." }
  }
  try {
    await prisma.workLocation.update({
      where: { id },
      data: {
        name: parsed.data.name,
        address: parsed.data.address || null,
        latitude: parseCoordinate(parsed.data.latitude),
        longitude: parseCoordinate(parsed.data.longitude),
        geofenceRadius: parsed.data.geofenceRadius,
      },
    })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { error: "Lokasi kerja dengan nama tersebut sudah ada." }
    }
    throw err
  }
  await logWorkLocation("UPDATE", parsed.data.name)
  revalidatePath("/admin/lokasi-kerja")
  return { success: true }
}

export async function deleteWorkLocationAction(id: number) {
  const workLocation = await prisma.workLocation.findUnique({ where: { id } })
  try {
    await prisma.workLocation.delete({ where: { id } })
  } catch {
    return {
      error: "Lokasi kerja masih dipakai oleh data pegawai, tidak bisa dihapus.",
    }
  }
  if (workLocation) {
    await logWorkLocation("DELETE", workLocation.name)
  }
  revalidatePath("/admin/lokasi-kerja")
  return undefined
}
