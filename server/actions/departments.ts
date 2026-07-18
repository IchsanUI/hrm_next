"use server"

import { Prisma } from "@prisma/client"
import { revalidatePath } from "next/cache"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity-log"
import { departmentSchema } from "@/lib/validations/master-data"

export type MasterDataState = { error?: string; success?: boolean } | undefined

function parseHeadEmployeeId(value: number | "" | undefined) {
  return value === "" || value === undefined ? null : value
}

async function logDepartment(action: string, name: string) {
  const session = await auth()
  await logActivity({
    userId: session?.user.id ? Number(session.user.id) : null,
    username: session?.user.username ?? "system",
    action,
    entityType: "Department",
    description: `${session?.user.username ?? "system"} ${
      action === "CREATE" ? "menambahkan" : action === "UPDATE" ? "memperbarui" : "menghapus"
    } bagian "${name}".`,
  })
}

export async function createDepartmentAction(
  _prevState: MasterDataState,
  formData: FormData
): Promise<MasterDataState> {
  const parsed = departmentSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: "Periksa kembali data yang diisi." }
  }
  try {
    await prisma.department.create({
      data: {
        name: parsed.data.name,
        code: parsed.data.code,
        headEmployeeId: parseHeadEmployeeId(parsed.data.headEmployeeId),
      },
    })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { error: "Kode bagian sudah dipakai." }
    }
    throw err
  }
  await logDepartment("CREATE", parsed.data.name)
  revalidatePath("/admin/bagian")
  return { success: true }
}

export async function updateDepartmentAction(
  id: number,
  _prevState: MasterDataState,
  formData: FormData
): Promise<MasterDataState> {
  const parsed = departmentSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: "Periksa kembali data yang diisi." }
  }
  try {
    await prisma.department.update({
      where: { id },
      data: {
        name: parsed.data.name,
        code: parsed.data.code,
        headEmployeeId: parseHeadEmployeeId(parsed.data.headEmployeeId),
      },
    })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { error: "Kode bagian sudah dipakai." }
    }
    throw err
  }
  await logDepartment("UPDATE", parsed.data.name)
  revalidatePath("/admin/bagian")
  return { success: true }
}

export async function deleteDepartmentAction(id: number) {
  const department = await prisma.department.findUnique({ where: { id } })
  try {
    await prisma.department.delete({ where: { id } })
  } catch {
    return { error: "Bagian masih dipakai oleh data pegawai, tidak bisa dihapus." }
  }
  if (department) {
    await logDepartment("DELETE", department.name)
  }
  revalidatePath("/admin/bagian")
  return undefined
}
