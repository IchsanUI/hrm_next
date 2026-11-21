"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity-log"
import { findOrgCycleKeys, parseChildEmployeeIds, type OrgTreeExternal } from "@/lib/org-tree"

export type OrgExternalResult = { error?: string; success?: boolean }

async function requireOrgManager() {
  const session = await auth()
  const user = session?.user
  if (!user) return null
  const allowed =
    user.role === "SUPER_ADMIN" ||
    (user.role === "HR_ADMIN" && user.menuAccess.includes("kepegawaian.struktur-organisasi"))
  return allowed ? user : null
}

const inputSchema = z.object({
  name: z.string().trim().min(2, "Nama minimal 2 karakter.").max(150),
  title: z.string().trim().min(2, "Jabatan minimal 2 karakter.").max(150),
  organization: z.string().trim().max(150).nullable(),
  parentType: z.enum(["none", "external", "employee"]),
  parentId: z.number().int().positive().nullable(),
  childEmployeeIds: z.array(z.number().int().positive()).max(50),
  sortOrder: z.number().int().min(0).max(999),
})

export type OrgExternalInput = z.infer<typeof inputSchema>

export async function saveOrgExternalAction(id: number | null, input: OrgExternalInput): Promise<OrgExternalResult> {
  const user = await requireOrgManager()
  if (!user) return { error: "Anda tidak punya akses mengelola Struktur Organisasi." }
  const parsed = inputSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Data tidak valid." }
  const v = parsed.data
  if (v.parentType !== "none" && !v.parentId) return { error: "Pilih posisi induknya." }

  const [employees, externals] = await Promise.all([
    prisma.employee.findMany({ where: { isDeleted: false }, select: { id: true, fullName: true, reportsToId: true } }),
    prisma.orgExternalNode.findMany(),
  ])
  const employeeIds = new Set(employees.map((e) => e.id))
  if (id !== null && !externals.some((x) => x.id === id)) return { error: "Data pihak luar tidak ditemukan." }
  if (v.parentType === "external" && (v.parentId === id || !externals.some((x) => x.id === v.parentId))) {
    return { error: "Induk pihak luar tidak valid." }
  }
  if (v.parentType === "employee" && !employeeIds.has(v.parentId!)) return { error: "Pegawai induk tidak ditemukan." }
  if (v.childEmployeeIds.some((eid) => !employeeIds.has(eid))) return { error: "Ada pegawai yang tidak ditemukan." }

  // Simulasikan struktur sesudah disimpan untuk menolak posisi yang berputar
  // (mis. Bupati membawahi Direktur Utama tetapi diletakkan di bawahnya).
  const candidate: OrgTreeExternal = {
    id: id ?? -1,
    name: v.name,
    title: v.title,
    organization: v.organization,
    parentExternalId: v.parentType === "external" ? v.parentId : null,
    parentEmployeeId: v.parentType === "employee" ? v.parentId : null,
    childEmployeeIds: [...new Set(v.childEmployeeIds)],
    sortOrder: v.sortOrder,
  }
  const simulated: OrgTreeExternal[] = [
    ...externals
      .filter((x) => x.id !== id)
      .map((x) => ({ ...x, childEmployeeIds: parseChildEmployeeIds(x.childEmployeeIds) })),
    candidate,
  ]
  const employeeRows = employees.map((e) => ({
    id: e.id,
    fullName: e.fullName,
    photoUrl: null,
    positionName: "",
    departmentName: "",
    reportsToId: e.reportsToId,
    isHead: false,
  }))
  if (findOrgCycleKeys(employeeRows, simulated).size > 0) {
    return { error: "Posisi ini membuat struktur berputar (induknya berada di bawah node ini sendiri). Pilih posisi lain." }
  }

  const data = {
    name: v.name,
    title: v.title,
    organization: v.organization || null,
    parentExternalId: candidate.parentExternalId,
    parentEmployeeId: candidate.parentEmployeeId,
    childEmployeeIds: candidate.childEmployeeIds,
    sortOrder: v.sortOrder,
  }
  if (id === null) await prisma.orgExternalNode.create({ data })
  else await prisma.orgExternalNode.update({ where: { id }, data })

  const childNames = employees.filter((e) => candidate.childEmployeeIds.includes(e.id)).map((e) => e.fullName)
  await logActivity({
    userId: Number(user.id),
    username: user.username,
    action: id === null ? "CREATE" : "UPDATE",
    entityType: "OrgExternalNode",
    description: `${user.username} ${id === null ? "menambahkan" : "mengubah"} pihak luar di Struktur Organisasi: ${v.name} (${v.title})${childNames.length ? `, membawahi ${childNames.join(", ")}` : ""}.`,
  })
  revalidatePath("/admin/struktur-organisasi")
  return { success: true }
}

export async function deleteOrgExternalAction(id: number): Promise<OrgExternalResult> {
  const user = await requireOrgManager()
  if (!user) return { error: "Anda tidak punya akses mengelola Struktur Organisasi." }
  const existing = await prisma.orgExternalNode.findUnique({ where: { id } })
  if (!existing) return { error: "Data pihak luar tidak ditemukan." }
  // Pihak luar di bawahnya naik ke induk node yang dihapus (bukan ikut hilang).
  await prisma.$transaction([
    prisma.orgExternalNode.updateMany({
      where: { parentExternalId: id },
      data: { parentExternalId: existing.parentExternalId, parentEmployeeId: existing.parentEmployeeId },
    }),
    prisma.orgExternalNode.delete({ where: { id } }),
  ])
  await logActivity({
    userId: Number(user.id),
    username: user.username,
    action: "DELETE",
    entityType: "OrgExternalNode",
    description: `${user.username} menghapus pihak luar dari Struktur Organisasi: ${existing.name} (${existing.title}).`,
  })
  revalidatePath("/admin/struktur-organisasi")
  return { success: true }
}
