"use server"

import { revalidatePath } from "next/cache"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity-log"
import { createNotification } from "@/lib/notifications"
import { parseMenuAccess } from "@/lib/hr-menu-access"
import { saveEmployeePhotoFile } from "@/lib/employee-photo-storage"
import { deleteEmployeeDocumentIfExists, saveEmployeeDocument } from "@/lib/employee-document-storage"
import {
  SELF_UPDATE_GROUPS,
  parseSelfUpdateGroups,
  type SelfUpdateGroupKey,
  type SelfUpdateTextField,
} from "@/lib/self-update-fields"

export type SelfUpdateFormState = { error?: string; success?: boolean } | undefined

// Update Mandiri — pegawai memperbarui datanya sendiri, HANYA pada grup yang
// dibuka admin (Employee.selfUpdateGroups, lihat setEmployeeSelfUpdateAction
// di server/actions/employees.ts & lib/self-update-fields.ts).
// - Foto & dokumen diunggah satu per satu (langsung tersimpan).
// - "Simpan & Selesai" menyimpan isian teks, MENGUNCI izin lagi (sekali
//   pakai per aktivasi admin), lalu mengirim ringkasan perubahan ke HR.

const SELF_UPLOAD_ENTITY = "EmployeeSelfUpdate"

const DOC_FIELD = {
  ktp: { field: "ktpFilePath", label: "KTP" },
  kk: { field: "kkFilePath", label: "Kartu Keluarga" },
  npwp: { field: "npwpFilePath", label: "NPWP" },
  marital: { field: "maritalDocumentFilePath", label: "Surat Nikah/Akta Cerai" },
} as const
export type SelfDocType = keyof typeof DOC_FIELD

async function loadOwnEmployee(requiredGroup?: SelfUpdateGroupKey) {
  const session = await auth()
  if (!session?.user.employeeId) return { error: "Akun Anda tidak terhubung ke data pegawai." } as const
  const employee = await prisma.employee.findUnique({ where: { id: session.user.employeeId } })
  if (!employee) return { error: "Data pegawai tidak ditemukan." } as const
  if (!employee.allowSelfUpdate) {
    return { error: "Izin update mandiri untuk akun Anda belum/tidak lagi aktif. Hubungi admin." } as const
  }
  const groups = parseSelfUpdateGroups(employee.selfUpdateGroups)
  if (requiredGroup && !groups.includes(requiredGroup)) {
    return { error: "Data ini tidak termasuk yang dibuka admin untuk Anda perbarui." } as const
  }
  return { session, employee, groups } as const
}

function revalidateProfile(publicId: string) {
  revalidatePath("/pegawai/profil")
  revalidatePath("/pegawai/update-data")
  revalidatePath("/admin/profil")
  revalidatePath(`/admin/pegawai/${publicId}/detail`)
}

export async function uploadOwnPhotoAction(_prev: SelfUpdateFormState, formData: FormData): Promise<SelfUpdateFormState> {
  const ctx = await loadOwnEmployee("pasfoto")
  if ("error" in ctx) return { error: ctx.error }
  const { session, employee } = ctx

  const saved = await saveEmployeePhotoFile(formData.get("photo"), employee.id)
  if ("error" in saved) return { error: saved.error }
  await prisma.employee.update({ where: { id: employee.id }, data: { photoUrl: saved.url } })

  await logActivity({
    userId: Number(session.user.id),
    username: session.user.username,
    action: "UPDATE",
    entityType: SELF_UPLOAD_ENTITY,
    description: `${session.user.username} mengganti pas foto lewat update mandiri.`,
  })
  revalidateProfile(employee.publicId)
  return { success: true }
}

export async function uploadOwnDocumentAction(
  docType: SelfDocType,
  _prev: SelfUpdateFormState,
  formData: FormData
): Promise<SelfUpdateFormState> {
  const doc = DOC_FIELD[docType]
  if (!doc) return { error: "Jenis dokumen tidak dikenali." }
  const ctx = await loadOwnEmployee("dokumen")
  if ("error" in ctx) return { error: ctx.error }
  const { session, employee } = ctx

  const result = await saveEmployeeDocument(formData.get("file"), "identitas", employee.id)
  if ("error" in result) return { error: result.error }
  await deleteEmployeeDocumentIfExists(employee[doc.field])
  await prisma.employee.update({ where: { id: employee.id }, data: { [doc.field]: result.filePath } })

  await logActivity({
    userId: Number(session.user.id),
    username: session.user.username,
    action: "UPDATE",
    entityType: SELF_UPLOAD_ENTITY,
    description: `${session.user.username} mengunggah dokumen ${doc.label} lewat update mandiri.`,
  })
  revalidateProfile(employee.publicId)
  return { success: true }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validateField(field: SelfUpdateTextField, raw: string): string | null {
  if (field.required && !raw) return `${field.label} wajib diisi`
  if (field.maxLength && raw.length > field.maxLength) return `${field.label} maksimal ${field.maxLength} karakter`
  if (field.type === "email" && raw && !EMAIL_RE.test(raw)) return `${field.label} tidak valid`
  return null
}

export async function updateOwnProfileAction(_prev: SelfUpdateFormState, formData: FormData): Promise<SelfUpdateFormState> {
  const ctx = await loadOwnEmployee()
  if ("error" in ctx) return { error: ctx.error }
  const { session, employee, groups } = ctx

  // Hanya field dari grup yang dibuka yang dibaca — field lain di FormData
  // (kalau ada yang menyisipkan) diabaikan.
  const data: Record<string, string | null> = {}
  const changedLabels: string[] = []
  for (const group of SELF_UPDATE_GROUPS) {
    if (group.kind !== "fields" || !groups.includes(group.key)) continue
    for (const field of group.fields as readonly SelfUpdateTextField[]) {
      const raw = String(formData.get(field.name) ?? "").trim()
      const error = validateField(field, raw)
      if (error) return { error }
      const value = raw || (field.required ? raw : null)
      data[field.name] = value
      if ((employee[field.name] ?? null) !== value) changedLabels.push(field.label)
    }
  }

  await prisma.employee.update({
    where: { id: employee.id },
    // Auto-lock — satu kali pakai per aktivasi admin.
    data: { ...data, allowSelfUpdate: false, selfUpdateGroups: [], selfUpdateOpenedAt: null },
  })

  // Unggahan foto/dokumen selama izin terbuka — ikut diringkas untuk HR.
  const uploads = employee.selfUpdateOpenedAt
    ? await prisma.activityLog.findMany({
        where: {
          userId: Number(session.user.id),
          entityType: SELF_UPLOAD_ENTITY,
          createdAt: { gte: employee.selfUpdateOpenedAt },
        },
        select: { description: true },
      })
    : []
  const uploadLabels = Array.from(
    new Set(
      uploads.map((u) =>
        u.description.includes("pas foto") ? "Pas Foto" : u.description.replace(/^.*mengunggah dokumen (.+) lewat.*$/, "$1")
      )
    )
  )
  const summary = [...changedLabels, ...uploadLabels]

  await logActivity({
    userId: Number(session.user.id),
    username: session.user.username,
    action: "UPDATE",
    entityType: "Employee",
    description: summary.length
      ? `${session.user.username} menyelesaikan update mandiri: ${summary.join(", ")}.`
      : `${session.user.username} menyelesaikan update mandiri tanpa perubahan data.`,
  })

  // Beri tahu HR yang mengelola Data Pegawai — terutama penting untuk
  // perubahan rekening bank (dipakai pembayaran klaim).
  if (summary.length) {
    const admins = await prisma.user.findMany({
      where: { isActive: true, role: { name: { in: ["SUPER_ADMIN", "HR_ADMIN"] } } },
      select: { id: true, menuAccess: true, role: { select: { name: true } } },
    })
    const recipients = admins.filter(
      (a) => a.role.name === "SUPER_ADMIN" || parseMenuAccess(a.menuAccess).includes("kepegawaian.pegawai")
    )
    const bankChanged = changedLabels.some((l) => ["Nama Bank", "No Rekening", "Atas Nama"].includes(l))
    await Promise.all(
      recipients.map((a) =>
        createNotification({
          userId: a.id,
          title: bankChanged ? "⚠ Update Mandiri: Rekening Bank Diubah" : "Update Mandiri Pegawai",
          message: `${employee.fullName} (${employee.employeeNumber}) memperbarui: ${summary.join(", ")}.`,
          link: `/admin/pegawai/${employee.publicId}/detail`,
        })
      )
    )
  }

  revalidateProfile(employee.publicId)
  revalidatePath("/admin/pegawai")
  return { success: true }
}
