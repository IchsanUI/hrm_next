import { z } from "zod"

export const backupSettingsSchema = z.object({
  mysqldumpPath: z.string().trim().min(1, "Lokasi mysqldump.exe wajib diisi."),
  retentionDays: z.coerce.number().int().min(1, "Minimal 1 hari.").max(3650, "Maksimal 3650 hari."),
})

export const BACKUP_SCOPE_VALUES = ["ALL", "KEPEGAWAIAN", "ABSENSI", "PAYROLL", "IZIN", "SISTEM"] as const

export const createBackupSchema = z.object({
  scope: z.enum(BACKUP_SCOPE_VALUES),
})
