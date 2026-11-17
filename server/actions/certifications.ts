"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity-log"
import { deleteCertificateFile, saveCertificateFile } from "@/lib/certificate-storage"

export type CertificationActionState = { error?: string; success?: boolean } | undefined

async function requireManager() {
  const session = await auth()
  const user = session?.user
  if (!user) return null
  const allowed =
    user.role === "SUPER_ADMIN" ||
    (user.role === "HR_ADMIN" && user.menuAccess.includes("kepegawaian.sertifikasi"))
  return allowed ? user : null
}

const NO_ACCESS = { error: "Anda tidak punya akses mengelola Sertifikasi & Pelatihan." }
const isoDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal tidak valid.")
const toDate = (iso: string) => new Date(`${iso}T00:00:00Z`)
const optionalText = (max: number, label: string) =>
  z.string().trim().max(max, `${label} maksimal ${max} karakter.`).optional()

function revalidate(employeePublicId?: string) {
  revalidatePath("/admin/sertifikasi")
  revalidatePath("/pegawai/profil")
  if (employeePublicId) revalidatePath(`/admin/pegawai/${employeePublicId}/detail`)
}

// ───────────────────────── Jenis sertifikasi ─────────────────────────

const typeSchema = z.object({
  name: z.string().trim().min(3, "Nama minimal 3 karakter.").max(255, "Nama maksimal 255 karakter."),
  kind: z.enum(["SERTIFIKASI", "PELATIHAN"], { message: "Pilih jenis: sertifikasi atau pelatihan." }),
  issuer: optionalText(191, "Penyelenggara"),
  validityMonths: z.coerce.number().int().min(0).max(240, "Masa berlaku maksimal 240 bulan."),
  reminderDays: z.coerce.number().int().min(1, "Pengingat minimal 1 hari.").max(365, "Pengingat maksimal 365 hari."),
  description: optionalText(2000, "Keterangan"),
})

function parseType(formData: FormData) {
  const parsed = typeSchema.safeParse({
    name: formData.get("name") ?? "",
    kind: formData.get("kind") ?? "",
    issuer: formData.get("issuer") ?? undefined,
    validityMonths: formData.get("validityMonths") || 0,
    reminderDays: formData.get("reminderDays") || 90,
    description: formData.get("description") ?? undefined,
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Periksa kembali data yang diisi." } as const
  const positionIds = formData
    .getAll("positionIds")
    .map((v) => Number(v))
    .filter((n) => Number.isInteger(n) && n > 0)
  const d = parsed.data
  return {
    data: {
      name: d.name,
      kind: d.kind,
      issuer: d.issuer || null,
      validityMonths: d.validityMonths || null,
      reminderDays: d.reminderDays,
      description: d.description || null,
      requiredForAll: formData.get("requiredForAll") === "on",
      isActive: formData.get("isActive") !== "off",
    },
    positionIds: [...new Set(positionIds)],
  } as const
}

export async function saveCertificationTypeAction(
  publicId: string | null,
  formData: FormData
): Promise<CertificationActionState> {
  const user = await requireManager()
  if (!user) return NO_ACCESS
  const parsed = parseType(formData)
  if ("error" in parsed) return { error: parsed.error }

  const duplicate = await prisma.certificationType.findFirst({
    where: { name: parsed.data.name, ...(publicId ? { NOT: { publicId } } : {}) },
    select: { id: true },
  })
  if (duplicate) return { error: "Nama sertifikasi/pelatihan ini sudah ada." }

  const requiredPositions = { create: parsed.positionIds.map((positionId) => ({ positionId })) }
  if (publicId) {
    const existing = await prisma.certificationType.findUnique({ where: { publicId } })
    if (!existing) return { error: "Data tidak ditemukan." }
    await prisma.$transaction([
      prisma.certificationTypePosition.deleteMany({ where: { certificationTypeId: existing.id } }),
      prisma.certificationType.update({ where: { id: existing.id }, data: { ...parsed.data, requiredPositions } }),
    ])
  } else {
    await prisma.certificationType.create({ data: { ...parsed.data, requiredPositions } })
  }

  await logActivity({
    userId: Number(user.id),
    username: user.username,
    action: publicId ? "UPDATE" : "CREATE",
    entityType: "CertificationType",
    description: `${user.username} ${publicId ? "memperbarui" : "menambahkan"} jenis sertifikasi/pelatihan "${parsed.data.name}".`,
  })
  revalidate()
  return { success: true }
}

export async function deleteCertificationTypeAction(publicId: string): Promise<CertificationActionState> {
  const user = await requireManager()
  if (!user) return NO_ACCESS
  const existing = await prisma.certificationType.findUnique({
    where: { publicId },
    include: { _count: { select: { certifications: true } } },
  })
  if (!existing) return { error: "Data tidak ditemukan." }
  if (existing._count.certifications > 0) {
    return {
      error: `Masih ada ${existing._count.certifications} sertifikat pegawai dengan jenis ini. Nonaktifkan saja agar riwayatnya tetap tersimpan.`,
    }
  }
  await prisma.certificationType.delete({ where: { id: existing.id } })
  await logActivity({
    userId: Number(user.id),
    username: user.username,
    action: "DELETE",
    entityType: "CertificationType",
    description: `${user.username} menghapus jenis sertifikasi/pelatihan "${existing.name}".`,
  })
  revalidate()
  return { success: true }
}

// ───────────────────────── Sertifikat pegawai ─────────────────────────

const certSchema = z.object({
  employeePublicId: z.string().min(1, "Pilih pegawai."),
  typePublicId: z.string().min(1, "Pilih jenis sertifikasi/pelatihan."),
  certificateNumber: optionalText(120, "Nomor sertifikat"),
  issuer: optionalText(191, "Penyelenggara"),
  issuedDate: isoDate,
  expiryDate: z.union([isoDate, z.literal("")]).optional(),
  notes: optionalText(2000, "Catatan"),
})

export async function saveEmployeeCertificationAction(
  publicId: string | null,
  formData: FormData
): Promise<CertificationActionState> {
  const user = await requireManager()
  if (!user) return NO_ACCESS

  const parsed = certSchema.safeParse({
    employeePublicId: formData.get("employeePublicId") ?? "",
    typePublicId: formData.get("typePublicId") ?? "",
    certificateNumber: formData.get("certificateNumber") ?? undefined,
    issuer: formData.get("issuer") ?? undefined,
    issuedDate: formData.get("issuedDate") ?? "",
    expiryDate: formData.get("expiryDate") ?? "",
    notes: formData.get("notes") ?? undefined,
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Periksa kembali data yang diisi." }
  const d = parsed.data
  if (d.expiryDate && d.expiryDate < d.issuedDate) {
    return { error: "Tanggal kedaluwarsa tidak boleh sebelum tanggal terbit." }
  }

  const [employee, type] = await Promise.all([
    prisma.employee.findUnique({ where: { publicId: d.employeePublicId }, select: { id: true, fullName: true, publicId: true } }),
    prisma.certificationType.findUnique({ where: { publicId: d.typePublicId }, select: { id: true, name: true } }),
  ])
  if (!employee) return { error: "Pegawai tidak ditemukan." }
  if (!type) return { error: "Jenis sertifikasi/pelatihan tidak ditemukan." }

  const existing = publicId ? await prisma.employeeCertification.findUnique({ where: { publicId } }) : null
  if (publicId && !existing) return { error: "Sertifikat tidak ditemukan." }

  const saved = await saveCertificateFile(formData.get("file"))
  if (saved && "error" in saved) return { error: saved.error }
  const removeFile = formData.get("removeFile") === "on"

  const expiryDate = d.expiryDate ? toDate(d.expiryDate) : null
  const data = {
    employeeId: employee.id,
    certificationTypeId: type.id,
    certificateNumber: d.certificateNumber || null,
    issuer: d.issuer || null,
    issuedDate: toDate(d.issuedDate),
    expiryDate,
    notes: d.notes || null,
    ...(saved ? saved : removeFile ? { storedFileName: null, originalFileName: null } : {}),
    // Tanggal kedaluwarsa berubah (mis. diperpanjang) → pengingat mulai dari awal lagi.
    ...(existing && existing.expiryDate?.getTime() !== expiryDate?.getTime() ? { lastReminderStage: null } : {}),
  }

  try {
    if (existing) {
      await prisma.employeeCertification.update({ where: { id: existing.id }, data })
    } else {
      await prisma.employeeCertification.create({ data: { ...data, createdBy: user.username } })
    }
  } catch (err) {
    if (saved) await deleteCertificateFile(saved.storedFileName)
    console.error("Gagal menyimpan sertifikat pegawai:", err)
    return { error: "Sertifikat gagal disimpan. Coba lagi." }
  }
  // File lama dihapus SETELAH data tersimpan, agar tidak pernah kehilangan file.
  if (existing && (saved || removeFile)) await deleteCertificateFile(existing.storedFileName)

  await logActivity({
    userId: Number(user.id),
    username: user.username,
    action: existing ? "UPDATE" : "CREATE",
    entityType: "EmployeeCertification",
    description: `${user.username} ${existing ? "memperbarui" : "menambahkan"} ${type.name} milik "${employee.fullName}".`,
  })
  revalidate(employee.publicId)
  return { success: true }
}

export async function deleteEmployeeCertificationAction(publicId: string): Promise<CertificationActionState> {
  const user = await requireManager()
  if (!user) return NO_ACCESS
  const existing = await prisma.employeeCertification.findUnique({
    where: { publicId },
    include: {
      employee: { select: { fullName: true, publicId: true } },
      certificationType: { select: { name: true } },
    },
  })
  if (!existing) return { error: "Sertifikat tidak ditemukan." }

  await prisma.employeeCertification.delete({ where: { id: existing.id } })
  await deleteCertificateFile(existing.storedFileName)
  await logActivity({
    userId: Number(user.id),
    username: user.username,
    action: "DELETE",
    entityType: "EmployeeCertification",
    description: `${user.username} menghapus ${existing.certificationType.name} milik "${existing.employee.fullName}".`,
  })
  revalidate(existing.employee.publicId)
  return { success: true }
}
