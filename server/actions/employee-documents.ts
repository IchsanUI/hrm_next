"use server"

import { revalidatePath } from "next/cache"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity-log"
import { saveEmployeeDocument, deleteEmployeeDocumentIfExists } from "@/lib/employee-document-storage"

export type DocumentUploadState = { error?: string; success?: boolean } | undefined

const DOC_TYPES = ["ktp", "kk", "npwp", "marital"] as const
export type EmployeeDocType = (typeof DOC_TYPES)[number]

const DOC_LABEL: Record<EmployeeDocType, string> = {
  ktp: "KTP",
  kk: "Kartu Keluarga",
  npwp: "NPWP",
  marital: "Surat Nikah/Akta Cerai",
}

const DOC_FIELD: Record<EmployeeDocType, "ktpFilePath" | "kkFilePath" | "npwpFilePath" | "maritalDocumentFilePath"> = {
  ktp: "ktpFilePath",
  kk: "kkFilePath",
  npwp: "npwpFilePath",
  marital: "maritalDocumentFilePath",
}

async function requireAdminSession() {
  const session = await auth()
  if (!session?.user) return { error: "Sesi tidak valid, silakan login ulang." } as const
  if (session.user.role !== "SUPER_ADMIN" && session.user.role !== "HR_ADMIN") {
    return { error: "Hanya Super Admin/HR Admin yang bisa mengunggah dokumen pegawai." } as const
  }
  return { userId: Number(session.user.id), username: session.user.username } as const
}

function revalidateEmployee(employeeId: number) {
  revalidatePath(`/admin/pegawai/${employeeId}`)
  revalidatePath(`/admin/pegawai/${employeeId}/detail`)
}

export async function uploadEmployeeDocumentAction(
  employeeId: number,
  docType: EmployeeDocType,
  _prevState: DocumentUploadState,
  formData: FormData
): Promise<DocumentUploadState> {
  const ctx = await requireAdminSession()
  if ("error" in ctx) return ctx

  if (!DOC_TYPES.includes(docType)) {
    return { error: "Jenis dokumen tidak dikenali." }
  }

  const employee = await prisma.employee.findUnique({ where: { id: employeeId } })
  if (!employee) {
    return { error: "Data pegawai tidak ditemukan." }
  }

  const result = await saveEmployeeDocument(formData.get("file"), "identitas", employeeId)
  if ("error" in result) {
    return { error: result.error }
  }

  const field = DOC_FIELD[docType]
  await deleteEmployeeDocumentIfExists(employee[field])
  await prisma.employee.update({
    where: { id: employeeId },
    data: { [field]: result.filePath },
  })

  await logActivity({
    userId: ctx.userId,
    username: ctx.username,
    action: "UPDATE",
    entityType: "Employee",
    description: `${ctx.username} mengunggah dokumen ${DOC_LABEL[docType]} untuk "${employee.fullName}" (${employee.employeeNumber}).`,
  })

  revalidateEmployee(employeeId)
  return { success: true }
}

export async function uploadChildBirthCertAction(
  childId: number,
  employeeId: number,
  _prevState: DocumentUploadState,
  formData: FormData
): Promise<DocumentUploadState> {
  const ctx = await requireAdminSession()
  if ("error" in ctx) return ctx

  const child = await prisma.employeeChild.findUnique({
    where: { id: childId },
    include: { employee: { select: { fullName: true, employeeNumber: true } } },
  })
  if (!child || child.employeeId !== employeeId) {
    return { error: "Data anak tidak ditemukan." }
  }

  const result = await saveEmployeeDocument(formData.get("file"), "akta-anak", employeeId)
  if ("error" in result) {
    return { error: result.error }
  }

  await deleteEmployeeDocumentIfExists(child.birthCertFilePath)
  await prisma.employeeChild.update({
    where: { id: childId },
    data: { birthCertFilePath: result.filePath },
  })

  await logActivity({
    userId: ctx.userId,
    username: ctx.username,
    action: "UPDATE",
    entityType: "Employee",
    description: `${ctx.username} mengunggah akta kelahiran "${child.fullName}" (anak dari ${child.employee.fullName}, ${child.employee.employeeNumber}).`,
  })

  revalidateEmployee(employeeId)
  return { success: true }
}
