// Script SATU KALI PAKAI buat simulasi rekonsiliasi akhir tahun/resign —
// meniru PERSIS logika generatePayslipsAction (server/actions/payroll-period.ts)
// tapi dijalankan lewat tsx (bukan Next.js request/server action) supaya
// tidak butuh sesi login. Menghitung pakai fungsi ASLI (calculatePayslip,
// computeAttendanceAllowanceDays) — bukan duplikat logika kalkulasi, cuma
// duplikat "lem" query DB di sekitarnya.
import { PrismaClient } from "@prisma/client"
import { calculatePayslip, type PayrollComponentDef, type PayrollTerRateDef } from "../lib/payroll/calculate"
import { computeAttendanceAllowanceDays } from "../lib/payroll/attendance-allowance"
import { TER_CATEGORY_BY_PTKP_STATUS } from "../lib/validations/payroll-tax"

const prisma = new PrismaClient()

async function main() {
  const payrollPeriodId = Number(process.argv[2])
  if (!payrollPeriodId) throw new Error("Usage: tsx scripts/simulate-generate-payslips.ts <payrollPeriodId>")

  const period = await prisma.payrollPeriod.findUnique({ where: { id: payrollPeriodId } })
  if (!period) throw new Error("Periode tidak ditemukan")
  console.log(`Generate payslip periode ${period.month}/${period.year} (${period.periodStart.toISOString().slice(0,10)} s/d ${period.periodEnd.toISOString().slice(0,10)})`)

  const [activeVersion, components, ptkpRates, taxBrackets, terRateRows, employees, manualEntryRows, bpjsSettings] =
    await Promise.all([
      prisma.salaryScaleVersion.findFirst({ where: { isActive: true } }),
      prisma.salaryComponent.findMany({ where: { isActive: true } }),
      prisma.ptkpRate.findMany(),
      prisma.taxBracket.findMany(),
      prisma.terRate.findMany(),
      prisma.employee.findMany({
        where: { isActive: true, isDeleted: false },
        include: {
          salaryComponents: true,
          position: { select: { attendanceRatePerDay: true } },
          workShift: { select: { workDays: true } },
        },
      }),
      prisma.payrollManualEntry.findMany({ where: { payrollPeriodId } }),
      prisma.bpjsSettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } }),
    ])

  const attendanceRangeStart = new Date(
    period.periodStart.getUTCFullYear(), period.periodStart.getUTCMonth(), period.periodStart.getUTCDate(), 0, 0, 0, 0
  )
  const attendanceRangeEnd = new Date(
    period.periodEnd.getUTCFullYear(), period.periodEnd.getUTCMonth(), period.periodEnd.getUTCDate(), 23, 59, 59, 999
  )

  const manualEntriesByEmployee = new Map<number, { salaryComponentId: number; amount: number }[]>()
  for (const entry of manualEntryRows) {
    const list = manualEntriesByEmployee.get(entry.employeeId) ?? []
    list.push({ salaryComponentId: entry.salaryComponentId, amount: entry.amount })
    manualEntriesByEmployee.set(entry.employeeId, list)
  }

  const priorPayslips = await prisma.payslip.findMany({
    where: {
      employeeId: { in: employees.map((e) => e.id) },
      payrollPeriod: { year: period.year, month: { lt: period.month } },
    },
    select: { employeeId: true, taxableMonthly: true, pph21: true },
  })
  const priorTaxDataByEmployee = new Map<number, { taxableSum: number; pph21Sum: number; monthsCovered: number }>()
  for (const p of priorPayslips) {
    const cur = priorTaxDataByEmployee.get(p.employeeId) ?? { taxableSum: 0, pph21Sum: 0, monthsCovered: 0 }
    cur.taxableSum += p.taxableMonthly
    cur.pph21Sum += p.pph21
    cur.monthsCovered += 1
    priorTaxDataByEmployee.set(p.employeeId, cur)
  }

  const golonganRates = activeVersion
    ? await prisma.salaryGradeRate.findMany({ where: { versionId: activeVersion.id } })
    : []
  const golonganRatesByGrade = new Map<number, { step: number; amount: number }[]>()
  for (const r of golonganRates) {
    const list = golonganRatesByGrade.get(r.salaryGradeId) ?? []
    list.push({ step: r.step, amount: r.amount })
    golonganRatesByGrade.set(r.salaryGradeId, list)
  }
  for (const list of golonganRatesByGrade.values()) list.sort((a, b) => a.step - b.step)
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
  const taxBracketDefs = taxBrackets.map((b) => ({ minIncome: b.minIncome, maxIncome: b.maxIncome, ratePercent: b.ratePercent }))
  const terRatesByCategory = new Map<string, PayrollTerRateDef[]>()
  for (const r of terRateRows) {
    const list = terRatesByCategory.get(r.category) ?? []
    list.push({ minIncome: r.minIncome, maxIncome: r.maxIncome, ratePercent: r.ratePercent })
    terRatesByCategory.set(r.category, list)
  }
  const componentDefs: PayrollComponentDef[] = components.map((c) => ({
    id: c.id, name: c.name, category: c.category, calculationType: c.calculationType,
    percentageValue: c.percentageValue, baseComponentId: c.baseComponentId, isTaxable: c.isTaxable, isBaseSalary: c.isBaseSalary,
  }))
  const hasAttendanceEarningComponent = componentDefs.some(
    (c) => c.calculationType === "KEHADIRAN" && (c.category === "PENDAPATAN_TETAP" || c.category === "PENDAPATAN_TIDAK_TETAP")
  )
  const hasAttendanceComponent = hasAttendanceEarningComponent || componentDefs.some((c) => c.calculationType === "KEHADIRAN" && c.category === "POTONGAN")

  const warnings: string[] = []
  const targetEmployees = employees.filter((e) => e.id === 205) // FOKUS simulasi: Mochammad Ichsan aja

  const payslipData = await Promise.all(
    targetEmployees.map(async (employee) => {
      const golonganRate = resolveGolonganRate(employee.salaryGradeId, employee.salaryGradeStep)
      const ptkpAnnualAmount = ptkpMap.get(employee.ptkpStatus ?? "TK0") ?? 0
      const terCategory = TER_CATEGORY_BY_PTKP_STATUS[employee.ptkpStatus ?? "TK0"]
      const terRates = terRatesByCategory.get(terCategory) ?? []

      const isFinalTaxPeriod =
        period.month === 12 ||
        (employee.resignDate !== null && employee.resignDate >= period.periodStart && employee.resignDate <= period.periodEnd)
      const priorTaxData = priorTaxDataByEmployee.get(employee.id) ?? { taxableSum: 0, pph21Sum: 0, monthsCovered: 0 }
      if (isFinalTaxPeriod && bpjsSettings.pph21Method === "TER") {
        const expectedPriorMonths = period.month - 1
        if (priorTaxData.monthsCovered < expectedPriorMonths) {
          warnings.push(
            `${employee.fullName}: rekonsiliasi akhir tahun cuma menemukan data payslip ${priorTaxData.monthsCovered} dari ${expectedPriorMonths} bulan sebelumnya di sistem tahun ${period.year}.`
          )
        }
      }

      const attendanceAllowance = hasAttendanceComponent
        ? await computeAttendanceAllowanceDays(employee.id, employee.pinAttendance, employee.workShift, period.periodStart, period.periodEnd, attendanceRangeStart, attendanceRangeEnd)
        : null

      const result = calculatePayslip({
        components: componentDefs,
        assignments: employee.salaryComponents.map((a) => ({ salaryComponentId: a.salaryComponentId, amount: a.amount, isActive: a.isActive })),
        manualEntries: manualEntriesByEmployee.get(employee.id) ?? [],
        golonganRate,
        attendanceAllowanceDays: attendanceAllowance?.days ?? 0,
        attendanceAllowanceUncoveredDays: attendanceAllowance?.uncoveredDays ?? 0,
        attendanceAllowanceBreakdown: attendanceAllowance ? attendanceAllowance.breakdown : null,
        attendanceRatePerDay: employee.position.attendanceRatePerDay,
        ptkpAnnualAmount,
        taxBrackets: taxBracketDefs,
        pph21Method: bpjsSettings.pph21Method,
        terRates,
        isFinalTaxPeriod,
        priorMonthsTaxableSum: priorTaxData.taxableSum,
        priorMonthsPph21Sum: priorTaxData.pph21Sum,
        priorMonthsCovered: priorTaxData.monthsCovered,
      })

      return { employeeId: employee.id, employeeName: employee.fullName, result, isFinalTaxPeriod, priorTaxData }
    })
  )

  await prisma.$transaction(async (tx) => {
    for (const { employeeId, result, isFinalTaxPeriod } of payslipData) {
      await tx.payslip.deleteMany({ where: { payrollPeriodId, employeeId } })
      await tx.payslip.create({
        data: {
          payrollPeriodId, employeeId,
          grossPay: result.grossPay, totalDeduction: result.totalDeduction, pph21: result.pph21, netPay: result.netPay,
          taxableMonthly: result.taxableMonthly, isFinalTaxPeriod,
          items: { create: result.items.map((item) => ({ salaryComponentId: item.salaryComponentId, name: item.name, detail: item.detail, category: item.category, amount: item.amount })) },
        },
      })
    }
  })

  console.log("\n=== HASIL ===")
  for (const d of payslipData) {
    console.log(`\nPegawai: ${d.employeeName} (isFinalTaxPeriod=${d.isFinalTaxPeriod})`)
    console.log(`  Data prior tersimpan: ${d.priorTaxData.monthsCovered} bulan, taxableSum=Rp${d.priorTaxData.taxableSum.toLocaleString("id-ID")}, pph21Sum=Rp${d.priorTaxData.pph21Sum.toLocaleString("id-ID")}`)
    console.log(`  Bruto bulan ini: Rp${d.result.grossPay.toLocaleString("id-ID")}`)
    console.log(`  taxableMonthly bulan ini: Rp${d.result.taxableMonthly.toLocaleString("id-ID")}`)
    console.log(`  PPh21 hasil: Rp${d.result.pph21.toLocaleString("id-ID")}`)
    console.log(`  NetPay: Rp${d.result.netPay.toLocaleString("id-ID")}`)
    const pph21Item = d.result.items.find((i) => i.name.includes("PPh 21"))
    if (pph21Item?.detail) console.log(`  Detail PPh21:\n    ${pph21Item.detail.split("\n").join("\n    ")}`)
  }
  console.log("\n=== WARNINGS ===")
  warnings.forEach((w) => console.log("- " + w))

  await prisma.$disconnect()
}

main().catch(async (err) => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
})
