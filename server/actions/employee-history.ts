"use server"

import { mkdir, writeFile } from "fs/promises"
import path from "path"

import { revalidatePath } from "next/cache"

import { prisma } from "@/lib/prisma"
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

// --- Riwayat Pekerjaan ---

export async function addWorkHistoryAction(
  employeeId: number,
  _prevState: HistoryFormState,
  formData: FormData
): Promise<HistoryFormState> {
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
  revalidateEmployee(employeeId)
  return undefined
}

export async function deleteWorkHistoryAction(id: number, employeeId: number) {
  await prisma.employeeWorkHistory.delete({ where: { id } })
  revalidateEmployee(employeeId)
}

// --- Riwayat Pendidikan dan Pelatihan ---

export async function addTrainingAction(
  employeeId: number,
  _prevState: HistoryFormState,
  formData: FormData
): Promise<HistoryFormState> {
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
  revalidateEmployee(employeeId)
  return undefined
}

export async function deleteTrainingAction(id: number, employeeId: number) {
  await prisma.employeeTraining.delete({ where: { id } })
  revalidateEmployee(employeeId)
}

// --- Data Prestasi ---

export async function addAchievementAction(
  employeeId: number,
  _prevState: HistoryFormState,
  formData: FormData
): Promise<HistoryFormState> {
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
  revalidateEmployee(employeeId)
  return undefined
}

export async function deleteAchievementAction(id: number, employeeId: number) {
  await prisma.employeeAchievement.delete({ where: { id } })
  revalidateEmployee(employeeId)
}

// --- Data Reward / Punishment ---

export async function addRewardPunishmentAction(
  employeeId: number,
  _prevState: HistoryFormState,
  formData: FormData
): Promise<HistoryFormState> {
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
  revalidateEmployee(employeeId)
  return undefined
}

export async function deleteRewardPunishmentAction(id: number, employeeId: number) {
  await prisma.employeeRewardPunishment.delete({ where: { id } })
  revalidateEmployee(employeeId)
}

// --- Data Mutasi Pegawai ---

export async function addMutationAction(
  employeeId: number,
  _prevState: HistoryFormState,
  formData: FormData
): Promise<HistoryFormState> {
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
  revalidateEmployee(employeeId)
  return undefined
}

export async function deleteMutationAction(id: number, employeeId: number) {
  await prisma.employeeMutation.delete({ where: { id } })
  revalidateEmployee(employeeId)
}

// --- Data Surat Tugas Pegawai ---

export async function addAssignmentLetterAction(
  employeeId: number,
  _prevState: HistoryFormState,
  formData: FormData
): Promise<HistoryFormState> {
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
  revalidateEmployee(employeeId)
  return undefined
}

export async function deleteAssignmentLetterAction(id: number, employeeId: number) {
  await prisma.employeeAssignmentLetter.delete({ where: { id } })
  revalidateEmployee(employeeId)
}
