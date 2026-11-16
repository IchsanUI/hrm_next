"use server"

import { mkdir, unlink, writeFile } from "fs/promises"
import path from "path"

import { revalidatePath } from "next/cache"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity-log"
import {
  workHistoryFormSchema,
  trainingFormSchema,
  achievementFormSchema,
  rewardPunishmentFormSchema,
  mutationFormSchema,
  assignmentLetterFormSchema,
} from "@/lib/validations/employee"

export type HistoryFormState = { error?: string } | undefined

function parseDate(value: string) {
  return new Date(value)
}

function revalidateEmployee(employeeId: number) {
  revalidatePath(`/admin/pegawai/${employeeId}`)
  revalidatePath(`/admin/pegawai/${employeeId}/detail`)
}

// Hak akses sama dengan pengelola Data Pegawai (lihat juga import riwayat).
async function canManageHistory() {
  const session = await auth()
  const role = session?.user.role
  return (
    role === "SUPER_ADMIN" ||
    (role === "HR_ADMIN" && !!session?.user.menuAccess.includes("kepegawaian.pegawai"))
  )
}

const NO_ACCESS: HistoryFormState = { error: "Anda tidak punya akses untuk mengubah data pegawai." }
const NOT_FOUND: HistoryFormState = { error: "Data tidak ditemukan (mungkin sudah dihapus)." }

// Dipakai berulang di semua sub-entitas riwayat pegawai (kerja, pelatihan,
// prestasi, reward/punishment, mutasi, surat tugas) — best-effort, diam-diam
// dilewati kalau session/data pegawainya tidak ketemu (tidak menggagalkan aksi utama).
async function logHistoryActivity(
  employeeId: number,
  action: "CREATE" | "UPDATE" | "DELETE",
  entityType: string,
  label: string,
  extra = ""
) {
  const session = await auth()
  if (!session?.user) return
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { fullName: true, employeeNumber: true },
  })
  if (!employee) return

  const verb = action === "CREATE" ? "menambahkan" : action === "UPDATE" ? "mengubah" : "menghapus"
  await logActivity({
    userId: Number(session.user.id),
    username: session.user.username,
    action,
    entityType,
    description: `${session.user.username} ${verb} ${label} untuk "${employee.fullName}" (${employee.employeeNumber})${extra}.`,
  })
}

const HISTORY_UPLOAD_ROOT = path.join(process.cwd(), "public", "uploads", "riwayat-pegawai")

async function saveOptionalFile(
  file: FormDataEntryValue | null,
  subDir: string,
  employeeId: number
): Promise<string | null> {
  if (!(file instanceof File) || file.size === 0) {
    return null
  }
  const uploadDir = path.join(process.cwd(), "public", "uploads", subDir)
  await mkdir(uploadDir, { recursive: true })

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
  const fileName = `${employeeId}-${Date.now()}-${safeName}`
  const buffer = Buffer.from(await file.arrayBuffer())
  await writeFile(path.join(uploadDir, fileName), buffer)

  return `/uploads/${subDir}/${fileName}`
}

// Hapus file pendukung lama dari disk supaya tidak menumpuk. HANYA file di
// dalam public/uploads/riwayat-pegawai/ yang boleh dihapus (cegah path
// traversal dari nilai fileUrl yang aneh). Best-effort: file yang sudah
// tidak ada diabaikan.
async function removeStoredFile(fileUrl: string | null | undefined) {
  if (!fileUrl || !fileUrl.startsWith("/uploads/riwayat-pegawai/")) return
  const absolute = path.resolve(process.cwd(), "public", `.${fileUrl}`)
  if (!absolute.startsWith(HISTORY_UPLOAD_ROOT + path.sep)) return
  await unlink(absolute).catch(() => {})
}

// Tentukan fileUrl baru saat edit: file baru diunggah → simpan & tandai file
// lama untuk dihapus; "removeFile=1" → kosongkan & tandai file lama untuk
// dihapus; selain itu file lama tetap dipakai. File lama baru benar-benar
// dihapus SETELAH update database berhasil (lihat finishFileChange).
async function resolveFileChange(
  formData: FormData,
  subDir: string,
  employeeId: number,
  currentFileUrl: string | null
): Promise<{ fileUrl: string | null; toDelete: string | null; note: string }> {
  const newFile = await saveOptionalFile(formData.get("file"), subDir, employeeId)
  if (newFile) {
    return { fileUrl: newFile, toDelete: currentFileUrl, note: currentFileUrl ? ", file pendukung diganti" : ", file pendukung ditambahkan" }
  }
  if (formData.get("removeFile") === "1" && currentFileUrl) {
    return { fileUrl: null, toDelete: currentFileUrl, note: ", file pendukung dihapus" }
  }
  return { fileUrl: currentFileUrl, toDelete: null, note: "" }
}

// --- Riwayat Pekerjaan ---

export async function addWorkHistoryAction(
  employeeId: number,
  _prevState: HistoryFormState,
  formData: FormData
): Promise<HistoryFormState> {
  if (!(await canManageHistory())) return NO_ACCESS
  const parsed = workHistoryFormSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: "Tanggal dan uraian wajib diisi." }
  }
  await prisma.employeeWorkHistory.create({
    data: {
      employeeId,
      date: parseDate(parsed.data.date),
      description: parsed.data.description,
    },
  })
  await logHistoryActivity(employeeId, "CREATE", "EmployeeWorkHistory", "riwayat pekerjaan")
  revalidateEmployee(employeeId)
  return undefined
}

export async function updateWorkHistoryAction(id: number, employeeId: number, formData: FormData): Promise<HistoryFormState> {
  if (!(await canManageHistory())) return NO_ACCESS
  const parsed = workHistoryFormSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: "Tanggal dan uraian wajib diisi." }
  const { count } = await prisma.employeeWorkHistory.updateMany({
    where: { id, employeeId },
    data: { date: parseDate(parsed.data.date), description: parsed.data.description },
  })
  if (count === 0) return NOT_FOUND
  await logHistoryActivity(employeeId, "UPDATE", "EmployeeWorkHistory", "riwayat pekerjaan")
  revalidateEmployee(employeeId)
  return undefined
}

export async function deleteWorkHistoryAction(id: number, employeeId: number): Promise<HistoryFormState> {
  if (!(await canManageHistory())) return NO_ACCESS
  const { count } = await prisma.employeeWorkHistory.deleteMany({ where: { id, employeeId } })
  if (count === 0) return NOT_FOUND
  await logHistoryActivity(employeeId, "DELETE", "EmployeeWorkHistory", "riwayat pekerjaan")
  revalidateEmployee(employeeId)
  return undefined
}

// --- Riwayat Pendidikan dan Pelatihan ---

export async function addTrainingAction(
  employeeId: number,
  _prevState: HistoryFormState,
  formData: FormData
): Promise<HistoryFormState> {
  if (!(await canManageHistory())) return NO_ACCESS
  const parsed = trainingFormSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: "Tanggal dan uraian wajib diisi." }
  }
  const fileUrl = await saveOptionalFile(
    formData.get("file"),
    "riwayat-pegawai/pelatihan",
    employeeId
  )
  await prisma.employeeTraining.create({
    data: {
      employeeId,
      date: parseDate(parsed.data.date),
      description: parsed.data.description,
      fileUrl,
    },
  })
  await logHistoryActivity(employeeId, "CREATE", "EmployeeTraining", "riwayat pendidikan/pelatihan")
  revalidateEmployee(employeeId)
  return undefined
}

export async function updateTrainingAction(id: number, employeeId: number, formData: FormData): Promise<HistoryFormState> {
  if (!(await canManageHistory())) return NO_ACCESS
  const parsed = trainingFormSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: "Tanggal dan uraian wajib diisi." }
  const existing = await prisma.employeeTraining.findFirst({ where: { id, employeeId } })
  if (!existing) return NOT_FOUND
  const file = await resolveFileChange(formData, "riwayat-pegawai/pelatihan", employeeId, existing.fileUrl)
  await prisma.employeeTraining.update({
    where: { id },
    data: { date: parseDate(parsed.data.date), description: parsed.data.description, fileUrl: file.fileUrl },
  })
  await removeStoredFile(file.toDelete)
  await logHistoryActivity(employeeId, "UPDATE", "EmployeeTraining", "riwayat pendidikan/pelatihan", file.note)
  revalidateEmployee(employeeId)
  return undefined
}

export async function deleteTrainingAction(id: number, employeeId: number): Promise<HistoryFormState> {
  if (!(await canManageHistory())) return NO_ACCESS
  const existing = await prisma.employeeTraining.findFirst({ where: { id, employeeId } })
  if (!existing) return NOT_FOUND
  await prisma.employeeTraining.delete({ where: { id } })
  await removeStoredFile(existing.fileUrl)
  await logHistoryActivity(employeeId, "DELETE", "EmployeeTraining", "riwayat pendidikan/pelatihan")
  revalidateEmployee(employeeId)
  return undefined
}

// --- Data Prestasi ---

export async function addAchievementAction(
  employeeId: number,
  _prevState: HistoryFormState,
  formData: FormData
): Promise<HistoryFormState> {
  if (!(await canManageHistory())) return NO_ACCESS
  const parsed = achievementFormSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: "Tanggal dan uraian wajib diisi." }
  }
  const fileUrl = await saveOptionalFile(
    formData.get("file"),
    "riwayat-pegawai/prestasi",
    employeeId
  )
  await prisma.employeeAchievement.create({
    data: {
      employeeId,
      date: parseDate(parsed.data.date),
      description: parsed.data.description,
      fileUrl,
    },
  })
  await logHistoryActivity(employeeId, "CREATE", "EmployeeAchievement", "data prestasi")
  revalidateEmployee(employeeId)
  return undefined
}

export async function updateAchievementAction(id: number, employeeId: number, formData: FormData): Promise<HistoryFormState> {
  if (!(await canManageHistory())) return NO_ACCESS
  const parsed = achievementFormSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: "Tanggal dan uraian wajib diisi." }
  const existing = await prisma.employeeAchievement.findFirst({ where: { id, employeeId } })
  if (!existing) return NOT_FOUND
  const file = await resolveFileChange(formData, "riwayat-pegawai/prestasi", employeeId, existing.fileUrl)
  await prisma.employeeAchievement.update({
    where: { id },
    data: { date: parseDate(parsed.data.date), description: parsed.data.description, fileUrl: file.fileUrl },
  })
  await removeStoredFile(file.toDelete)
  await logHistoryActivity(employeeId, "UPDATE", "EmployeeAchievement", "data prestasi", file.note)
  revalidateEmployee(employeeId)
  return undefined
}

export async function deleteAchievementAction(id: number, employeeId: number): Promise<HistoryFormState> {
  if (!(await canManageHistory())) return NO_ACCESS
  const existing = await prisma.employeeAchievement.findFirst({ where: { id, employeeId } })
  if (!existing) return NOT_FOUND
  await prisma.employeeAchievement.delete({ where: { id } })
  await removeStoredFile(existing.fileUrl)
  await logHistoryActivity(employeeId, "DELETE", "EmployeeAchievement", "data prestasi")
  revalidateEmployee(employeeId)
  return undefined
}

// --- Data Reward / Punishment ---

export async function addRewardPunishmentAction(
  employeeId: number,
  _prevState: HistoryFormState,
  formData: FormData
): Promise<HistoryFormState> {
  if (!(await canManageHistory())) return NO_ACCESS
  const parsed = rewardPunishmentFormSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: "Tanggal, jenis, dan uraian wajib diisi." }
  }
  await prisma.employeeRewardPunishment.create({
    data: {
      employeeId,
      date: parseDate(parsed.data.date),
      type: parsed.data.type,
      description: parsed.data.description,
    },
  })
  await logHistoryActivity(employeeId, "CREATE", "EmployeeRewardPunishment", "data reward/punishment")
  revalidateEmployee(employeeId)
  return undefined
}

export async function updateRewardPunishmentAction(id: number, employeeId: number, formData: FormData): Promise<HistoryFormState> {
  if (!(await canManageHistory())) return NO_ACCESS
  const parsed = rewardPunishmentFormSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: "Tanggal, jenis, dan uraian wajib diisi." }
  const { count } = await prisma.employeeRewardPunishment.updateMany({
    where: { id, employeeId },
    data: { date: parseDate(parsed.data.date), type: parsed.data.type, description: parsed.data.description },
  })
  if (count === 0) return NOT_FOUND
  await logHistoryActivity(employeeId, "UPDATE", "EmployeeRewardPunishment", "data reward/punishment")
  revalidateEmployee(employeeId)
  return undefined
}

export async function deleteRewardPunishmentAction(id: number, employeeId: number): Promise<HistoryFormState> {
  if (!(await canManageHistory())) return NO_ACCESS
  const { count } = await prisma.employeeRewardPunishment.deleteMany({ where: { id, employeeId } })
  if (count === 0) return NOT_FOUND
  await logHistoryActivity(employeeId, "DELETE", "EmployeeRewardPunishment", "data reward/punishment")
  revalidateEmployee(employeeId)
  return undefined
}

// --- Data Mutasi Pegawai ---

export async function addMutationAction(
  employeeId: number,
  _prevState: HistoryFormState,
  formData: FormData
): Promise<HistoryFormState> {
  if (!(await canManageHistory())) return NO_ACCESS
  const parsed = mutationFormSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: "Tanggal wajib diisi." }
  }
  const fileUrl = await saveOptionalFile(
    formData.get("file"),
    "riwayat-pegawai/mutasi",
    employeeId
  )
  await prisma.employeeMutation.create({
    data: {
      employeeId,
      date: parseDate(parsed.data.date),
      oldPosition: parsed.data.oldPosition || null,
      newPosition: parsed.data.newPosition || null,
      description: parsed.data.description || null,
      fileUrl,
    },
  })
  await logHistoryActivity(employeeId, "CREATE", "EmployeeMutation", "data mutasi pegawai")
  revalidateEmployee(employeeId)
  return undefined
}

export async function updateMutationAction(id: number, employeeId: number, formData: FormData): Promise<HistoryFormState> {
  if (!(await canManageHistory())) return NO_ACCESS
  const parsed = mutationFormSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: "Tanggal wajib diisi." }
  const existing = await prisma.employeeMutation.findFirst({ where: { id, employeeId } })
  if (!existing) return NOT_FOUND
  const file = await resolveFileChange(formData, "riwayat-pegawai/mutasi", employeeId, existing.fileUrl)
  await prisma.employeeMutation.update({
    where: { id },
    data: {
      date: parseDate(parsed.data.date),
      oldPosition: parsed.data.oldPosition || null,
      newPosition: parsed.data.newPosition || null,
      description: parsed.data.description || null,
      fileUrl: file.fileUrl,
    },
  })
  await removeStoredFile(file.toDelete)
  await logHistoryActivity(employeeId, "UPDATE", "EmployeeMutation", "data mutasi pegawai", file.note)
  revalidateEmployee(employeeId)
  return undefined
}

export async function deleteMutationAction(id: number, employeeId: number): Promise<HistoryFormState> {
  if (!(await canManageHistory())) return NO_ACCESS
  const existing = await prisma.employeeMutation.findFirst({ where: { id, employeeId } })
  if (!existing) return NOT_FOUND
  await prisma.employeeMutation.delete({ where: { id } })
  await removeStoredFile(existing.fileUrl)
  await logHistoryActivity(employeeId, "DELETE", "EmployeeMutation", "data mutasi pegawai")
  revalidateEmployee(employeeId)
  return undefined
}

// --- Data Surat Tugas Pegawai ---

export async function addAssignmentLetterAction(
  employeeId: number,
  _prevState: HistoryFormState,
  formData: FormData
): Promise<HistoryFormState> {
  if (!(await canManageHistory())) return NO_ACCESS
  const parsed = assignmentLetterFormSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: "Tanggal dan uraian wajib diisi." }
  }
  const fileUrl = await saveOptionalFile(
    formData.get("file"),
    "riwayat-pegawai/surat-tugas",
    employeeId
  )
  await prisma.employeeAssignmentLetter.create({
    data: {
      employeeId,
      date: parseDate(parsed.data.date),
      description: parsed.data.description,
      fileUrl,
    },
  })
  await logHistoryActivity(employeeId, "CREATE", "EmployeeAssignmentLetter", "data surat tugas")
  revalidateEmployee(employeeId)
  return undefined
}

export async function updateAssignmentLetterAction(id: number, employeeId: number, formData: FormData): Promise<HistoryFormState> {
  if (!(await canManageHistory())) return NO_ACCESS
  const parsed = assignmentLetterFormSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: "Tanggal dan uraian wajib diisi." }
  const existing = await prisma.employeeAssignmentLetter.findFirst({ where: { id, employeeId } })
  if (!existing) return NOT_FOUND
  const file = await resolveFileChange(formData, "riwayat-pegawai/surat-tugas", employeeId, existing.fileUrl)
  await prisma.employeeAssignmentLetter.update({
    where: { id },
    data: { date: parseDate(parsed.data.date), description: parsed.data.description, fileUrl: file.fileUrl },
  })
  await removeStoredFile(file.toDelete)
  await logHistoryActivity(employeeId, "UPDATE", "EmployeeAssignmentLetter", "data surat tugas", file.note)
  revalidateEmployee(employeeId)
  return undefined
}

export async function deleteAssignmentLetterAction(id: number, employeeId: number): Promise<HistoryFormState> {
  if (!(await canManageHistory())) return NO_ACCESS
  const existing = await prisma.employeeAssignmentLetter.findFirst({ where: { id, employeeId } })
  if (!existing) return NOT_FOUND
  await prisma.employeeAssignmentLetter.delete({ where: { id } })
  await removeStoredFile(existing.fileUrl)
  await logHistoryActivity(employeeId, "DELETE", "EmployeeAssignmentLetter", "data surat tugas")
  revalidateEmployee(employeeId)
  return undefined
}
