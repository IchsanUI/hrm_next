"use server"

import { revalidatePath } from "next/cache"

import { Prisma } from "@prisma/client"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity-log"
import { employeeSalaryComponentSchema } from "@/lib/validations/employee-salary-component"

export type EmployeeSalaryComponentState = { error?: string } | undefined

function parseOptionalNumber(value: number | "" | undefined) {
  return value === "" || value === undefined ? null : value
}

function revalidateEmployee(employeeId: number) {
  revalidatePath(`/admin/pegawai/${employeeId}`)
  revalidatePath(`/admin/pegawai/${employeeId}/detail`)
}

async function logAssignment(employeeId: number, action: "CREATE" | "UPDATE" | "DELETE", label: string) {
  const session = await auth()
  if (!session?.user) return
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { fullName: true, employeeNumber: true },
  })
  if (!employee) return

  const verb = action === "CREATE" ? "menambahkan" : action === "UPDATE" ? "memperbarui" : "menghapus"
  await logActivity({
    userId: Number(session.user.id),
    username: session.user.username,
    action,
    entityType: "EmployeeSalaryComponent",
    description: `${session.user.username} ${verb} komponen gaji "${label}" untuk "${employee.fullName}" (${employee.employeeNumber}).`,
  })
}

// Tambah/perbarui nilai komponen gaji pegawai — SELALU upsert (bukan
// create-only), jadi kalau admin memilih komponen yang sudah pernah
// diassign, nominalnya langsung ditimpa alih-alih error duplikat. Cuma
// komponen dengan calculationType NOMINAL_TETAP atau PERSENTASE yang boleh
// diassign di sini (lihat catatan di schema.prisma pada EmployeeSalaryComponent).
export async function upsertEmployeeSalaryComponentAction(
  employeeId: number,
  _prevState: EmployeeSalaryComponentState,
  formData: FormData
): Promise<EmployeeSalaryComponentState> {
  const parsed = employeeSalaryComponentSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Data tidak valid." }
  }
  const data = parsed.data

  const component = await prisma.salaryComponent.findUnique({
    where: { id: data.salaryComponentId },
  })
  if (!component) {
    return { error: "Komponen gaji tidak ditemukan." }
  }
  if (component.calculationType === "KEHADIRAN" || component.calculationType === "MANUAL_PERIODE") {
    return {
      error: `Komponen "${component.name}" nilainya ditentukan tiap periode payroll, tidak diassign di sini.`,
    }
  }

  const amount = parseOptionalNumber(data.amount)
  if (component.calculationType === "NOMINAL_TETAP" && amount === null) {
    return { error: `Nominal wajib diisi untuk komponen "${component.name}".` }
  }

  try {
    await prisma.employeeSalaryComponent.upsert({
      where: {
        employeeId_salaryComponentId: { employeeId, salaryComponentId: data.salaryComponentId },
      },
      update: { amount: component.calculationType === "NOMINAL_TETAP" ? amount : null, isActive: true },
      create: {
        employeeId,
        salaryComponentId: data.salaryComponentId,
        amount: component.calculationType === "NOMINAL_TETAP" ? amount : null,
      },
    })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { error: `Komponen "${component.name}" sudah diassign.` }
    }
    throw err
  }

  await logAssignment(employeeId, "CREATE", component.name)
  revalidateEmployee(employeeId)
  return undefined
}

export async function toggleEmployeeSalaryComponentActiveAction(
  id: number,
  employeeId: number,
  isActive: boolean
) {
  const assignment = await prisma.employeeSalaryComponent.update({
    where: { id },
    data: { isActive },
    include: { salaryComponent: { select: { name: true } } },
  })
  await logAssignment(employeeId, "UPDATE", assignment.salaryComponent.name)
  revalidateEmployee(employeeId)
}

export async function deleteEmployeeSalaryComponentAction(id: number, employeeId: number) {
  const assignment = await prisma.employeeSalaryComponent.findUnique({
    where: { id },
    include: { salaryComponent: { select: { name: true } } },
  })
  if (!assignment) return
  await prisma.employeeSalaryComponent.delete({ where: { id } })
  await logAssignment(employeeId, "DELETE", assignment.salaryComponent.name)
  revalidateEmployee(employeeId)
}
