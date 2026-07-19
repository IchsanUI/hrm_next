"use server"

import { revalidatePath } from "next/cache"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity-log"
import { leaveBalanceAdjustSchema } from "@/lib/validations/leave-balance"

export type LeaveBalanceFormState = { error?: string } | undefined

export async function adjustLeaveBalanceAction(
  _prevState: LeaveBalanceFormState,
  formData: FormData
): Promise<LeaveBalanceFormState> {
  const session = await auth()
  const isAdminRole = session?.user.role === "SUPER_ADMIN" || session?.user.role === "HR_ADMIN"
  if (!session?.user || !isAdminRole) {
    return { error: "Anda tidak berwenang mengubah saldo cuti." }
  }

  const parsed = leaveBalanceAdjustSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Data tidak valid." }
  }

  const employee = await prisma.employee.findUnique({
    where: { id: parsed.data.employeeId },
    select: { fullName: true },
  })
  if (!employee) {
    return { error: "Pegawai tidak ditemukan." }
  }

  await prisma.employeeLeaveBalance.upsert({
    where: { employeeId_year: { employeeId: parsed.data.employeeId, year: parsed.data.year } },
    update: {
      quota: parsed.data.quota,
      adjustment: parsed.data.adjustment,
      note: parsed.data.note || null,
    },
    create: {
      employeeId: parsed.data.employeeId,
      year: parsed.data.year,
      quota: parsed.data.quota,
      adjustment: parsed.data.adjustment,
      note: parsed.data.note || null,
    },
  })

  await logActivity({
    userId: Number(session.user.id),
    username: session.user.username,
    action: "UPDATE",
    entityType: "EmployeeLeaveBalance",
    description: `${session.user.username} mengatur saldo cuti ${parsed.data.year} untuk "${employee.fullName}" (jatah ${parsed.data.quota}, penyesuaian ${parsed.data.adjustment}).`,
  })

  revalidatePath("/admin/saldo-cuti")
  return undefined
}
