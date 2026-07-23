"use server"

import { revalidatePath } from "next/cache"

import { Prisma } from "@prisma/client"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity-log"
import { payrollPeriodSchema } from "@/lib/validations/payroll-period"
import { calculatePayslip, type PayrollComponentDef } from "@/lib/payroll/calculate"
import { computeAttendanceAllowanceDays, STANDARD_WORK_DAYS } from "@/lib/payroll/attendance-allowance"

export type PayrollPeriodState = { error?: string } | undefined
export type GeneratePayslipsState =
  | { success: true; generated: number; warnings: string[] }
  | { success: false; error: string }
  | undefined

const LIST_PATH = "/admin/payroll/proses"

function detailPath(id: number) {
  return `${LIST_PATH}/${id}`
}

// Periode SELALU tanggal 21 bulan sebelumnya s/d tanggal 20 bulan berjalan
// (kesepakatan awal modul payroll) — `month`/`year` merujuk bulan PEMBAYARAN
// (bulan tanggal 20-nya), bukan bulan mulai cut-off.
function computePeriodDates(year: number, month: number) {
  const periodEnd = new Date(Date.UTC(year, month - 1, 20))
  const periodStart = new Date(Date.UTC(year, month - 2, 21))
  return { periodStart, periodEnd }
}

async function logPeriod(action: "CREATE" | "UPDATE" | "DELETE", label: string) {
  const session = await auth()
  await logActivity({
    userId: session?.user.id ? Number(session.user.id) : null,
    username: session?.user.username ?? "system",
    action,
    entityType: "PayrollPeriod",
    description: `${session?.user.username ?? "system"} ${
      action === "CREATE" ? "membuat" : action === "UPDATE" ? "memperbarui" : "menghapus"
    } periode payroll "${label}".`,
  })
}

export async function createPayrollPeriodAction(
  _prevState: PayrollPeriodState,
  formData: FormData
): Promise<PayrollPeriodState> {
  const parsed = payrollPeriodSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Data tidak valid." }
  }
  const { year, month } = parsed.data
  const { periodStart, periodEnd } = computePeriodDates(year, month)

  try {
    await prisma.payrollPeriod.create({
      data: { year, month, periodStart, periodEnd },
    })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { error: `Periode ${month}/${year} sudah ada.` }
    }
    throw err
  }
  await logPeriod("CREATE", `${month}/${year}`)
  revalidatePath(LIST_PATH)
  return undefined
}

export async function deletePayrollPeriodAction(id: number): Promise<PayrollPeriodState> {
  const period = await prisma.payrollPeriod.findUnique({ where: { id } })
  if (!period) return undefined
  if (period.status === "LOCKED") {
    return { error: "Periode yang sudah dikunci tidak bisa dihapus." }
  }
  await prisma.payrollPeriod.delete({ where: { id } })
  await logPeriod("DELETE", `${period.month}/${period.year}`)
  revalidatePath(LIST_PATH)
  return undefined
}

export async function lockPayrollPeriodAction(id: number): Promise<PayrollPeriodState> {
  const session = await auth()
  const period = await prisma.payrollPeriod.findUnique({ where: { id } })
  if (!period) return { error: "Periode tidak ditemukan." }

  await prisma.payrollPeriod.update({
    where: { id },
    data: { status: "LOCKED", lockedAt: new Date(), lockedBy: session?.user.username ?? "system" },
  })
  await logPeriod("UPDATE", `${period.month}/${period.year} (dikunci)`)
  revalidatePath(LIST_PATH)
  revalidatePath(detailPath(id))
  return undefined
}

export async function unlockPayrollPeriodAction(id: number): Promise<PayrollPeriodState> {
  const period = await prisma.payrollPeriod.findUnique({ where: { id } })
  if (!period) return { error: "Periode tidak ditemukan." }

  await prisma.payrollPeriod.update({
    where: { id },
    data: { status: "DRAFT", lockedAt: null, lockedBy: null },
  })
  await logPeriod("UPDATE", `${period.month}/${period.year} (dibuka kunci)`)
  revalidatePath(LIST_PATH)
  revalidatePath(detailPath(id))
  return undefined
}

// Hitung ulang & timpa SELURUH payslip periode ini dari nol — aman dijalankan
// berkali-kali selama periode masih DRAFT (idempotent), makanya payslip lama
// dihapus dulu sebelum payslip baru dibuat, semuanya dalam satu transaksi.
export async function generatePayslipsAction(payrollPeriodId: number): Promise<GeneratePayslipsState> {
  const period = await prisma.payrollPeriod.findUnique({ where: { id: payrollPeriodId } })
  if (!period) {
    return { success: false, error: "Periode tidak ditemukan." }
  }
  if (period.status === "LOCKED") {
    return { success: false, error: "Periode sudah dikunci, tidak bisa digenerate ulang." }
  }

  const [activeVersion, components, ptkpRates, taxBrackets, employees, manualEntryRows] = await Promise.all([
    prisma.salaryScaleVersion.findFirst({ where: { isActive: true } }),
    prisma.salaryComponent.findMany({ where: { isActive: true } }),
    prisma.ptkpRate.findMany(),
    prisma.taxBracket.findMany(),
    prisma.employee.findMany({
      where: { isActive: true, isDeleted: false },
      include: {
        salaryComponents: true,
        position: { select: { attendanceRatePerDay: true } },
        workShift: { select: { workDays: true } },
      },
    }),
    prisma.payrollManualEntry.findMany({ where: { payrollPeriodId } }),
  ])

  // period.periodStart/periodEnd tersimpan sebagai kolom @db.Date (tengah
  // malam UTC merepresentasikan TANGGAL kalendernya saja, tidak ada info
  // jam/zona waktu). AttendanceLog.logTime sebaliknya di-parse dari string
  // device TANPA suffix Z (lihat lib/attendance/attendance-note.ts) — Node
  // menafsirkan string semacam itu sebagai jam DINDING LOKAL server, dan
  // server ini jalan di WIB (UTC+7, sudah dicek). Jadi buat nge-bandingin
  // "tanggal kalender" periode ke AttendanceLog dengan benar, batas
  // start/end HARUS dibangun lewat constructor Date LOKAL (bukan
  // Date.UTC/setUTCHours) — kalau dulu dipakai UTC, batas akhir jadi
  // "nge-geser" 7 jam ke pagi hari BERIKUTNYA (tap jam 00:00-06:59 WIB
  // besoknya ikut kehitung), dan batas awal juga telat 7 jam (tap dini
  // hari di tanggal awal malah kelewat).
  const attendanceRangeStart = new Date(
    period.periodStart.getUTCFullYear(),
    period.periodStart.getUTCMonth(),
    period.periodStart.getUTCDate(),
    0,
    0,
    0,
    0
  )
  const attendanceRangeEnd = new Date(
    period.periodEnd.getUTCFullYear(),
    period.periodEnd.getUTCMonth(),
    period.periodEnd.getUTCDate(),
    23,
    59,
    59,
    999
  )

  const manualEntriesByEmployee = new Map<number, { salaryComponentId: number; amount: number }[]>()
  for (const entry of manualEntryRows) {
    const list = manualEntriesByEmployee.get(entry.employeeId) ?? []
    list.push({ salaryComponentId: entry.salaryComponentId, amount: entry.amount })
    manualEntriesByEmployee.set(entry.employeeId, list)
  }

  const golonganRates = activeVersion
    ? await prisma.salaryGradeRate.findMany({ where: { versionId: activeVersion.id } })
    : []
  // Tabel PP resmi cuma punya baris MKG genap (kenaikan berkala tiap 2
  // tahun) — kalau step pegawai belum genap ke kelipatan berikutnya,
  // gaji pokoknya tetap pakai nilai MKG genap TERBESAR yang sudah dicapai
  // (bukan 0), makanya di-grup per golongan dan diurutkan, bukan exact match.
  const golonganRatesByGrade = new Map<number, { step: number; amount: number }[]>()
  for (const r of golonganRates) {
    const list = golonganRatesByGrade.get(r.salaryGradeId) ?? []
    list.push({ step: r.step, amount: r.amount })
    golonganRatesByGrade.set(r.salaryGradeId, list)
  }
  for (const list of golonganRatesByGrade.values()) {
    list.sort((a, b) => a.step - b.step)
  }
  function resolveGolonganRate(salaryGradeId: number | null, step: number | null): number | null {
    if (salaryGradeId === null || step === null) return null
    const list = golonganRatesByGrade.get(salaryGradeId)
    if (!list || list.length === 0) return null
    let match: number | null = null
    for (const entry of list) {
      if (entry.step <= step) match = entry.amount
      else break
    }
    return match
  }
  const ptkpMap = new Map(ptkpRates.map((r) => [r.status, r.annualAmount]))
  const taxBracketDefs = taxBrackets.map((b) => ({
    minIncome: b.minIncome,
    maxIncome: b.maxIncome,
    ratePercent: b.ratePercent,
  }))
  const componentDefs: PayrollComponentDef[] = components.map((c) => ({
    id: c.id,
    name: c.name,
    category: c.category,
    calculationType: c.calculationType,
    percentageValue: c.percentageValue,
    baseComponentId: c.baseComponentId,
    isTaxable: c.isTaxable,
    isBaseSalary: c.isBaseSalary,
  }))

  const hasAttendanceEarningComponent = componentDefs.some(
    (c) =>
      c.calculationType === "KEHADIRAN" &&
      (c.category === "PENDAPATAN_TETAP" || c.category === "PENDAPATAN_TIDAK_TETAP")
  )

  const warnings: string[] = []

  const payslipData = await Promise.all(
    employees.map(async (employee) => {
      const golonganRate = resolveGolonganRate(employee.salaryGradeId, employee.salaryGradeStep)

      const ptkpAnnualAmount = ptkpMap.get(employee.ptkpStatus ?? "TK0") ?? 0
      if (!employee.ptkpStatus) {
        warnings.push(`${employee.fullName}: status PTKP belum diisi, dianggap TK/0.`)
      }
      if (hasAttendanceEarningComponent && employee.position.attendanceRatePerDay !== null) {
        if (!employee.workShift) {
          warnings.push(
            `${employee.fullName}: belum punya Jam Kerja, hari kerja dianggap Senin-Jumat (default) buat hitung Tunjangan Kehadiran.`
          )
        }
        if (!employee.pinAttendance) {
          warnings.push(
            `${employee.fullName}: belum ada PIN mesin absensi, semua hari kerja tanpa izin dianggap mangkir.`
          )
        }
      }

      const attendanceAllowance = hasAttendanceEarningComponent
        ? await computeAttendanceAllowanceDays(
            employee.id,
            employee.pinAttendance,
            employee.workShift,
            period.periodStart,
            period.periodEnd,
            attendanceRangeStart,
            attendanceRangeEnd
          )
        : null

      const result = calculatePayslip({
        components: componentDefs,
        assignments: employee.salaryComponents.map((a) => ({
          salaryComponentId: a.salaryComponentId,
          amount: a.amount,
          isActive: a.isActive,
        })),
        manualEntries: manualEntriesByEmployee.get(employee.id) ?? [],
        golonganRate,
        attendanceAllowanceDays: attendanceAllowance?.days ?? 0,
        attendanceAllowanceBreakdown: attendanceAllowance
          ? { standardDays: STANDARD_WORK_DAYS, ...attendanceAllowance.breakdown }
          : null,
        attendanceRatePerDay: employee.position.attendanceRatePerDay,
        ptkpAnnualAmount,
        taxBrackets: taxBracketDefs,
      })

      if (result.gajiPokokSource === "kosong") {
        warnings.push(`${employee.fullName}: Gaji Pokok tidak ditemukan (golongan/step kosong & belum ada nilai manual).`)
      }

      return { employeeId: employee.id, result }
    })
  )

  await prisma.$transaction(async (tx) => {
    await tx.payslip.deleteMany({ where: { payrollPeriodId } })
    for (const { employeeId, result } of payslipData) {
      await tx.payslip.create({
        data: {
          payrollPeriodId,
          employeeId,
          grossPay: result.grossPay,
          totalDeduction: result.totalDeduction,
          pph21: result.pph21,
          netPay: result.netPay,
          items: {
            create: result.items.map((item) => ({
              salaryComponentId: item.salaryComponentId,
              name: item.name,
              detail: item.detail,
              category: item.category,
              amount: item.amount,
            })),
          },
        },
      })
    }
  })

  await logPeriod("UPDATE", `${period.month}/${period.year} (generate ${payslipData.length} payslip)`)
  revalidatePath(LIST_PATH)
  revalidatePath(detailPath(payrollPeriodId))

  return { success: true, generated: payslipData.length, warnings }
}
