"use server"

import { revalidatePath } from "next/cache"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity-log"

export type PayrollManualEntryState = { error?: string } | undefined

async function logManualEntry(employeeId: number, label: string) {
  const session = await auth()
  if (!session?.user) return
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { fullName: true, employeeNumber: true },
  })
  if (!employee) return

  await logActivity({
    userId: Number(session.user.id),
    username: session.user.username,
    action: "UPDATE",
    entityType: "PayrollManualEntry",
    description: `${session.user.username} memperbarui ${label} untuk "${employee.fullName}" (${employee.employeeNumber}).`,
  })
}

// Field FormData bernama `component_<salaryComponentId>` — dipakai buat
// komponen bertipe MANUAL_PERIODE (Insentif, Lembur, SPPD, Kredit, dst.).
// Nilai kosong/0 = hapus entri (baris tidak muncul di payslip), bukan
// disimpan sebagai 0 (lihat catatan di lib/payroll/calculate.ts).
export async function upsertPayrollManualEntriesAction(
  payrollPeriodId: number,
  employeeId: number,
  _prevState: PayrollManualEntryState,
  formData: FormData
): Promise<PayrollManualEntryState> {
  const period = await prisma.payrollPeriod.findUnique({ where: { id: payrollPeriodId } })
  if (!period) return { error: "Periode tidak ditemukan." }
  if (period.status === "LOCKED") {
    return { error: "Periode sudah dikunci, tidak bisa mengisi komponen manual." }
  }

  const manualComponents = await prisma.salaryComponent.findMany({
    where: { isActive: true, calculationType: "MANUAL_PERIODE" },
  })

  await prisma.$transaction(async (tx) => {
    for (const component of manualComponents) {
      const raw = formData.get(`component_${component.id}`)
      const amount = raw !== null && raw !== "" ? Number(raw) : null

      if (amount === null || Number.isNaN(amount) || amount === 0) {
        await tx.payrollManualEntry.deleteMany({
          where: { payrollPeriodId, employeeId, salaryComponentId: component.id },
        })
      } else {
        await tx.payrollManualEntry.upsert({
          where: {
            payrollPeriodId_employeeId_salaryComponentId: {
              payrollPeriodId,
              employeeId,
              salaryComponentId: component.id,
            },
          },
          update: { amount },
          create: { payrollPeriodId, employeeId, salaryComponentId: component.id, amount },
        })
      }
    }
  })

  await logManualEntry(employeeId, "komponen manual per periode")
  revalidatePath(`/admin/payroll/proses/${payrollPeriodId}`)
  return undefined
}
