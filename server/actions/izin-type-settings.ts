"use server"

import { revalidatePath } from "next/cache"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity-log"
import { LEAVE_TYPES } from "@/lib/leave-types"
import { IZIN_TYPES_WITH_CUTOFF } from "@/lib/izin-type-settings-constants"

export type IzinTypeSettingState = { error?: string } | undefined

const CUTOFF_TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/

export async function updateIzinTypeSettingAction(
  leaveType: string,
  _prevState: IzinTypeSettingState,
  formData: FormData
): Promise<IzinTypeSettingState> {
  const session = await auth()
  if (session?.user.role !== "SUPER_ADMIN") {
    return { error: "Anda tidak berhak mengubah pengaturan ini." }
  }

  const leaveTypeOption = LEAVE_TYPES.find((t) => t.value === leaveType)
  if (!leaveTypeOption) {
    return { error: "Jenis izin tidak dikenal." }
  }

  const isActive = formData.get("isActive") === "on"
  const rawCutoff = String(formData.get("submissionCutoffTime") ?? "").trim()

  if (rawCutoff && !IZIN_TYPES_WITH_CUTOFF.has(leaveType)) {
    return { error: "Jenis izin ini tidak mendukung batas jam pengajuan." }
  }
  if (rawCutoff && !CUTOFF_TIME_PATTERN.test(rawCutoff)) {
    return { error: "Format jam batas pengajuan tidak valid." }
  }

  await prisma.izinTypeSetting.upsert({
    where: { leaveType },
    create: { leaveType, isActive, submissionCutoffTime: rawCutoff || null },
    update: { isActive, submissionCutoffTime: rawCutoff || null },
  })

  await logActivity({
    userId: session.user.id ? Number(session.user.id) : null,
    username: session.user.username,
    action: "UPDATE",
    entityType: "IzinTypeSetting",
    description: `${session.user.username} memperbarui pengaturan "${leaveTypeOption.label}" — status ${
      isActive ? "aktif" : "nonaktif"
    }${rawCutoff ? `, batas jam pengajuan ${rawCutoff}` : ""}.`,
  })

  revalidatePath("/admin/izin/pengaturan")
  return undefined
}
