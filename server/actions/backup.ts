"use server"

import { randomBytes } from "crypto"
import { unlink } from "fs/promises"
import { revalidatePath } from "next/cache"

import type { BackupScope } from "@prisma/client"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity-log"
import { getBackupScopeTables } from "@/lib/backup/table-groups"
import { runBackupJob } from "@/lib/backup/run-backup"
import { backupSettingsSchema, createBackupSchema } from "@/lib/validations/backup"

function generatePublicId() {
  return randomBytes(10).toString("hex")
}

function revalidateBackupPaths() {
  revalidatePath("/admin/backup/manual")
  revalidatePath("/admin/backup/riwayat")
}

async function requireSuperAdmin() {
  const session = await auth()
  if (session?.user.role !== "SUPER_ADMIN") {
    return { error: "Hanya SUPER_ADMIN yang bisa mengakses fitur Backup." as const, session: null }
  }
  return { error: null, session }
}

export type CreateBackupResult = { error?: string; publicId?: string; tablesTotal?: number }

export async function createBackupAction(scope: BackupScope): Promise<CreateBackupResult> {
  const { error, session } = await requireSuperAdmin()
  if (error || !session) return { error: error ?? "Sesi tidak valid." }

  const parsed = createBackupSchema.safeParse({ scope })
  if (!parsed.success) return { error: "Cakupan backup tidak valid." }

  // Total tabel buat penyebut progress bar — ALL dihitung langsung dari
  // information_schema (bukan hardcode) supaya tetap akurat kalau tabel baru
  // ditambah di kemudian hari; scope lain pakai daftar tetap di table-groups.ts.
  let tablesTotal: number
  const scopedTables = getBackupScopeTables(parsed.data.scope)
  if (scopedTables) {
    tablesTotal = scopedTables.length
  } else {
    const rows = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = DATABASE()
    `
    tablesTotal = Number(rows[0]?.count ?? 0)
  }

  const backup = await prisma.backup.create({
    data: {
      publicId: generatePublicId(),
      scope: parsed.data.scope,
      status: "RUNNING",
      triggeredByUserId: Number(session.user.id),
      triggeredByUsername: session.user.username,
      tablesTotal,
    },
  })

  // SENGAJA tidak di-await — inilah yang bikin tombol "Backup Sekarang"
  // langsung balik tanpa nunggu dump selesai (lihat lib/backup/run-backup.ts).
  void runBackupJob(backup.id, parsed.data.scope)

  await logActivity({
    userId: Number(session.user.id),
    username: session.user.username,
    action: "CREATE",
    entityType: "Backup",
    description: `Memicu backup manual (${backup.publicId}) — cakupan ${parsed.data.scope}.`,
  })

  revalidateBackupPaths()
  return { publicId: backup.publicId, tablesTotal }
}

export type BackupStatusResult = {
  error?: string
  status?: "RUNNING" | "SUCCESS" | "FAILED"
  tablesDone?: number
  tablesTotal?: number
  errorMessage?: string | null
  fileSizeBytes?: number | null
}

export async function getBackupStatusAction(publicId: string): Promise<BackupStatusResult> {
  const { error } = await requireSuperAdmin()
  if (error) return { error }

  const backup = await prisma.backup.findUnique({
    where: { publicId },
    select: { status: true, tablesDone: true, tablesTotal: true, errorMessage: true, fileSizeBytes: true },
  })
  if (!backup) return { error: "Backup tidak ditemukan." }

  return {
    status: backup.status,
    tablesDone: backup.tablesDone,
    tablesTotal: backup.tablesTotal,
    errorMessage: backup.errorMessage,
    fileSizeBytes: backup.fileSizeBytes,
  }
}

export async function deleteBackupAction(publicId: string): Promise<{ error?: string }> {
  const { error, session } = await requireSuperAdmin()
  if (error || !session) return { error: error ?? "Sesi tidak valid." }

  const backup = await prisma.backup.findUnique({ where: { publicId } })
  if (!backup) return { error: "Backup tidak ditemukan." }

  if (backup.filePath) {
    await unlink(backup.filePath).catch(() => {})
  }
  await prisma.backup.delete({ where: { id: backup.id } })

  await logActivity({
    userId: Number(session.user.id),
    username: session.user.username,
    action: "DELETE",
    entityType: "Backup",
    description: `Menghapus backup (${backup.publicId}) — cakupan ${backup.scope}.`,
  })

  revalidateBackupPaths()
  return {}
}

export type BackupSettingsFormState = { error?: string; success?: boolean } | undefined

export async function updateBackupSettingsAction(
  _prevState: BackupSettingsFormState,
  formData: FormData
): Promise<BackupSettingsFormState> {
  const { error } = await requireSuperAdmin()
  if (error) return { error }

  const parsed = backupSettingsSchema.safeParse({
    mysqldumpPath: formData.get("mysqldumpPath"),
    retentionDays: formData.get("retentionDays"),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Pengaturan tidak valid." }
  }

  await prisma.backupSettings.upsert({
    where: { id: 1 },
    update: { mysqldumpPath: parsed.data.mysqldumpPath, retentionDays: parsed.data.retentionDays },
    create: {
      id: 1,
      mysqldumpPath: parsed.data.mysqldumpPath,
      retentionDays: parsed.data.retentionDays,
    },
  })

  revalidateBackupPaths()
  return { success: true }
}
