"use server"

import { revalidatePath } from "next/cache"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity-log"
import { LEAVE_TYPES } from "@/lib/leave-types"
import {
  IZIN_TYPES_WITH_CUTOFF,
  IZIN_TYPES_WITH_MONTHLY_LIMIT,
  IZIN_TYPES_ELIGIBLE_FOR_ATTENDANCE_TOGGLE,
} from "@/lib/izin-type-settings-constants"

export type IzinTypeSettingState = { error?: string } | undefined

const CUTOFF_TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/

export async function updateIzinTypeSettingAction(
  leaveType: string,
  _prevState: IzinTypeSettingState,
  formData: FormData
): Promise<IzinTypeSettingState> {
  const session = await auth()
  const isAdminRole = session?.user.role === "SUPER_ADMIN" || session?.user.role === "HR_ADMIN"
  const hasAccess =
    session?.user.role === "SUPER_ADMIN" ||
    session?.user.menuAccess.includes("approval.pengaturan")
  if (!isAdminRole || !hasAccess) {
    return { error: "Anda tidak berhak mengubah pengaturan ini." }
  }

  const leaveTypeOption = LEAVE_TYPES.find((t) => t.value === leaveType)
  if (!leaveTypeOption) {
    return { error: "Jenis izin tidak dikenal." }
  }

  const isActive = formData.get("isActive") === "on"
  const rawCutoff = String(formData.get("submissionCutoffTime") ?? "").trim()
  const rawLimit = String(formData.get("submissionLimitPerMonth") ?? "").trim()

  if (rawCutoff && !IZIN_TYPES_WITH_CUTOFF.has(leaveType)) {
    return { error: "Jenis izin ini tidak mendukung batas jam pengajuan." }
  }
  if (rawCutoff && !CUTOFF_TIME_PATTERN.test(rawCutoff)) {
    return { error: "Format jam batas pengajuan tidak valid." }
  }
  if (rawLimit && !IZIN_TYPES_WITH_MONTHLY_LIMIT.has(leaveType)) {
    return { error: "Jenis izin ini tidak mendukung batas pengajuan per bulan." }
  }
  let submissionLimitPerMonth: number | null = null
  if (rawLimit) {
    const parsedLimit = Number(rawLimit)
    if (!Number.isInteger(parsedLimit) || parsedLimit < 1) {
      return { error: "Batas pengajuan per bulan harus angka bulat minimal 1." }
    }
    submissionLimitPerMonth = parsedLimit
  }

  const isEligibleForAttendanceToggle = IZIN_TYPES_ELIGIBLE_FOR_ATTENDANCE_TOGGLE.has(leaveType)
  const rawReduces = formData.get("reducesAttendanceAllowance")
  if (rawReduces !== null && !isEligibleForAttendanceToggle) {
    return { error: "Jenis izin ini tidak mendukung pengaturan Tunjangan Kehadiran." }
  }
  // Checkbox custom (base-ui) selalu kirim hidden input "on"/"off" kalau
  // baris ini punya toggle-nya (lihat components/izin-type-settings-table.tsx)
  // — null cuma buat jenis izin yang memang tidak render toggle ini sama
  // sekali, disimpan null (pakai default per-jenis, lihat defaultSetting()).
  const reducesAttendanceAllowance = isEligibleForAttendanceToggle ? rawReduces === "on" : null

  await prisma.izinTypeSetting.upsert({
    where: { leaveType },
    create: {
      leaveType,
      isActive,
      submissionCutoffTime: rawCutoff || null,
      submissionLimitPerMonth,
      reducesAttendanceAllowance,
    },
    update: { isActive, submissionCutoffTime: rawCutoff || null, submissionLimitPerMonth, reducesAttendanceAllowance },
  })

  await logActivity({
    userId: session.user.id ? Number(session.user.id) : null,
    username: session.user.username,
    action: "UPDATE",
    entityType: "IzinTypeSetting",
    description: `${session.user.username} memperbarui pengaturan "${leaveTypeOption.label}" — status ${
      isActive ? "aktif" : "nonaktif"
    }${rawCutoff ? `, batas jam pengajuan ${rawCutoff}` : ""}${
      submissionLimitPerMonth ? `, batas pengajuan ${submissionLimitPerMonth}x/bulan` : ""
    }${
      isEligibleForAttendanceToggle
        ? `, ${reducesAttendanceAllowance ? "mengurangi" : "tidak mengurangi"} Tunjangan Kehadiran`
        : ""
    }.`,
  })

  revalidatePath("/admin/izin/pengaturan")
  return undefined
}
