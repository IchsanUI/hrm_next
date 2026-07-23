// Mesin hitung Proses Payroll — SATU pegawai SATU periode per panggilan.
//
// Simplifikasi yang SENGAJA diambil di fase ini (didiskusikan & disetujui):
// - Metode PPh 21 "gross" biasa (bukan gross-up/net), biaya jabatan pakai
//   aturan standar 5% dibatasi maks Rp 500.000/bulan, dan dasar pengenaan
//   pajak TIDAK dikurangi iuran BPJS pegawai (nuansa itu butuh flag
//   tambahan per komponen yang belum ada — payslip tetap menampilkan angka
//   yang wajar, tapi bukan pengganti perhitungan resmi/konsultasi pajak).
// - Komponen bertipe KEHADIRAN kategori PENDAPATAN (mis. "Tunjangan
//   Kehadiran") dihitung otomatis = rate per hari (dari Position pegawai,
//   lihat `attendanceRatePerDay`) × `attendanceAllowanceDays` — jumlah hari
//   yang SUDAH DIHITUNG di lib/payroll/attendance-allowance.ts (model
//   "standar 22 hari/bulan, dikurangi kalau ada yang tidak ditanggung":
//   Cuti/Cuti Besar/Cuti Diluar Tanggungan/Pulang Cepat sebelum jam 12/
//   mangkir tanpa keterangan — Sakit & Dispensasi/SPPD tetap ditanggung
//   penuh, tidak mengurangi). File ini SENGAJA tidak tahu apa-apa soal
//   absensi/izin — cuma menerima angka hari jadi yang tinggal dikalikan,
//   biar logika absensinya terpusat di satu tempat. TIDAK perlu di-assign
//   manual di EmployeeSalaryComponent (sama seperti Gaji Pokok, otomatis
//   untuk semua pegawai yang jabatannya punya rate). Komponen KEHADIRAN
//   kategori POTONGAN/PINJAMAN (mis. "Pot. Kehadiran/Punishment") SENGAJA
//   masih dilewati (dianggap 0) — aturannya belum didefinisikan. Komponen
//   bertipe MANUAL_PERIODE (Lembur, Insentif, SPPD, Kredit, dst.) SEKARANG bisa
//   diisi manual per pegawai per periode lewat PayrollManualEntry (lihat
//   `manualEntries` param) — cuma muncul sebagai baris payslip kalau memang
//   ada entri untuk periode itu (tidak ada entri = tidak tampil, bukan 0).
// - "PPh 21" SELALU dihitung otomatis oleh mesin ini (PTKP + tarif
//   progresif), TIDAK dibaca dari komponen "PPh 21" (MANUAL_PERIODE) di
//   master data — dua hal itu sengaja dipisah.

export type PayrollComponentCategory =
  | "PENDAPATAN_TETAP"
  | "PENDAPATAN_TIDAK_TETAP"
  | "POTONGAN"
  | "PINJAMAN"

export type PayrollCalculationType = "NOMINAL_TETAP" | "PERSENTASE" | "KEHADIRAN" | "MANUAL_PERIODE"

export type PayrollComponentDef = {
  id: number
  name: string
  category: PayrollComponentCategory
  calculationType: PayrollCalculationType
  percentageValue: number | null
  baseComponentId: number | null
  isTaxable: boolean
  isBaseSalary: boolean
}

export type PayrollAssignmentDef = {
  salaryComponentId: number
  amount: number | null
  isActive: boolean
}

export type PayrollManualEntryDef = {
  salaryComponentId: number
  amount: number
}

export type PayrollTaxBracketDef = {
  minIncome: number
  maxIncome: number | null
  ratePercent: number
}

export type PayrollLineItem = {
  salaryComponentId: number | null
  name: string
  detail: string | null // info tambahan buat ditampilkan di baris terpisah (mis. "21 hari x Rp30.000")
  category: PayrollComponentCategory
  amount: number
}

export type PayrollCalculationResult = {
  gajiPokok: number
  gajiPokokSource: "golongan" | "manual" | "kosong"
  grossPay: number
  totalDeduction: number
  pph21: number
  netPay: number
  items: PayrollLineItem[]
}

function formatRupiahShort(value: number) {
  return `Rp${Math.round(value).toLocaleString("id-ID")}`
}

// Detail 3 baris pendek buat baris "Tunjangan Kehadiran" di payslip —
// dipecah per baris (bukan satu kalimat panjang) biar tetap rapi dibaca
// walau kolomnya sempit:
//   1. Standar vs hari kerja riil periode ini (21-20)
//   2. Rincian pengurang (cuma yang >0 biar tidak berisik kalau nol semua)
//   3. Hasil akhir × rate, plus data tap mesin sebagai pembanding
function formatAttendanceAllowanceDetail(
  breakdown: AttendanceAllowanceBreakdown,
  days: number,
  ratePerDay: number
): string {
  const deductions = [
    ["Cuti", breakdown.cutiDays],
    ["Cuti Besar", breakdown.cutiBesarDays],
    ["CDT", breakdown.unpaidLeaveDays],
    ["Pulang Cepat<12:00", breakdown.earlyLeaveDays],
    ["Mangkir", breakdown.mangkirDays],
  ] as const
  const activeDeductions = deductions.filter(([, count]) => count > 0)

  const lines = [
    `Standar ${breakdown.standardDays} hari`,
    activeDeductions.length > 0
      ? `Potongan: ${activeDeductions.map(([label, count]) => `${label} ${count}`).join(", ")}`
      : "Potongan: tidak ada",
    `= ${days} hari × ${formatRupiahShort(ratePerDay)}`,
    `Hari kerja periode ini (21-20): ${breakdown.totalWorkDaysInPeriod} hari`,
    `Tap mesin (referensi): ${breakdown.presentDaysRaw} hari hadir`,
  ]

  return lines.join("\n")
}

function calculateProgressiveTax(pkp: number, brackets: PayrollTaxBracketDef[]): number {
  const sorted = [...brackets].sort((a, b) => a.minIncome - b.minIncome)
  let tax = 0
  for (const bracket of sorted) {
    if (pkp <= bracket.minIncome) continue
    const upper = bracket.maxIncome ?? Infinity
    const amountInBracket = Math.min(pkp, upper) - bracket.minIncome
    if (amountInBracket > 0) {
      tax += (amountInBracket * bracket.ratePercent) / 100
    }
  }
  return tax
}

export type AttendanceAllowanceBreakdown = {
  standardDays: number
  cutiDays: number
  cutiBesarDays: number
  unpaidLeaveDays: number
  earlyLeaveDays: number
  mangkirDays: number
  presentDaysRaw: number
  totalWorkDaysInPeriod: number
}

export function calculatePayslip(params: {
  components: PayrollComponentDef[]
  assignments: PayrollAssignmentDef[]
  manualEntries: PayrollManualEntryDef[]
  golonganRate: number | null // hasil lookup SalaryGradeRate untuk golongan+step+versi aktif pegawai ini, null kalau tidak ketemu
  attendanceAllowanceDays: number // hasil akhir dari computeAttendanceAllowanceDays (sudah dipotong standar 22 hari)
  attendanceAllowanceBreakdown: AttendanceAllowanceBreakdown | null // buat ditampilkan sebagai detail rumus, null kalau komponen kehadirannya tidak aktif
  attendanceRatePerDay: number | null // rate/hari dari Position pegawai, null = jabatannya tidak dapat tunjangan kehadiran
  ptkpAnnualAmount: number
  taxBrackets: PayrollTaxBracketDef[]
}): PayrollCalculationResult {
  const {
    components,
    assignments,
    manualEntries,
    golonganRate,
    attendanceAllowanceDays,
    attendanceAllowanceBreakdown,
    attendanceRatePerDay,
    ptkpAnnualAmount,
    taxBrackets,
  } = params

  const componentsById = new Map(components.map((c) => [c.id, c]))
  const assignmentByComponentId = new Map(assignments.map((a) => [a.salaryComponentId, a]))
  const manualEntryByComponentId = new Map(manualEntries.map((m) => [m.salaryComponentId, m.amount]))

  const baseSalaryComponent = components.find((c) => c.isBaseSalary) ?? null
  const baseSalaryAssignment = baseSalaryComponent
    ? assignmentByComponentId.get(baseSalaryComponent.id)
    : undefined

  let gajiPokok = 0
  let gajiPokokSource: PayrollCalculationResult["gajiPokokSource"] = "kosong"
  if (golonganRate !== null) {
    gajiPokok = golonganRate
    gajiPokokSource = "golongan"
  } else if (baseSalaryAssignment?.isActive && baseSalaryAssignment.amount !== null) {
    gajiPokok = baseSalaryAssignment.amount
    gajiPokokSource = "manual"
  }

  function isAttendanceEarning(component: PayrollComponentDef) {
    return (
      component.calculationType === "KEHADIRAN" &&
      (component.category === "PENDAPATAN_TETAP" || component.category === "PENDAPATAN_TIDAK_TETAP") &&
      attendanceRatePerDay !== null
    )
  }

  const memo = new Map<number, number>()
  if (baseSalaryComponent) memo.set(baseSalaryComponent.id, gajiPokok)

  function resolve(componentId: number): number {
    const memoized = memo.get(componentId)
    if (memoized !== undefined) return memoized

    const component = componentsById.get(componentId)
    if (!component) return 0

    let value = 0
    if (component.isBaseSalary) {
      value = gajiPokok
    } else if (component.calculationType === "MANUAL_PERIODE") {
      value = manualEntryByComponentId.get(componentId) ?? 0
    } else if (isAttendanceEarning(component)) {
      value = (attendanceRatePerDay ?? 0) * attendanceAllowanceDays
    } else {
      const assignment = assignmentByComponentId.get(componentId)
      if (assignment?.isActive) {
        if (component.calculationType === "NOMINAL_TETAP") {
          value = assignment.amount ?? 0
        } else if (component.calculationType === "PERSENTASE") {
          const base = component.baseComponentId ? resolve(component.baseComponentId) : 0
          value = ((component.percentageValue ?? 0) / 100) * base
        }
        // KEHADIRAN kategori POTONGAN/PINJAMAN sengaja tetap 0 (lihat catatan di atas).
      }
    }

    memo.set(componentId, value)
    return value
  }

  const items: PayrollLineItem[] = []
  if (baseSalaryComponent) {
    items.push({
      salaryComponentId: baseSalaryComponent.id,
      name: baseSalaryComponent.name,
      detail: null,
      category: baseSalaryComponent.category,
      amount: gajiPokok,
    })
  } else {
    items.push({
      salaryComponentId: null,
      name: "Gaji Pokok",
      detail: null,
      category: "PENDAPATAN_TETAP",
      amount: gajiPokok,
    })
  }

  for (const component of components) {
    if (component.isBaseSalary) continue
    const isIncluded = isAttendanceEarning(component)
      ? true
      : component.calculationType === "MANUAL_PERIODE"
        ? manualEntryByComponentId.has(component.id)
        : (assignmentByComponentId.get(component.id)?.isActive ?? false)
    if (!isIncluded) continue
    items.push({
      salaryComponentId: component.id,
      name: component.name,
      detail:
        isAttendanceEarning(component) && attendanceAllowanceBreakdown
          ? formatAttendanceAllowanceDetail(
              attendanceAllowanceBreakdown,
              attendanceAllowanceDays,
              attendanceRatePerDay ?? 0
            )
          : null,
      category: component.category,
      amount: resolve(component.id),
    })
  }

  const grossPay = items
    .filter((item) => item.category === "PENDAPATAN_TETAP" || item.category === "PENDAPATAN_TIDAK_TETAP")
    .reduce((sum, item) => sum + item.amount, 0)

  const otherDeductions = items
    .filter((item) => item.category === "POTONGAN" || item.category === "PINJAMAN")
    .reduce((sum, item) => sum + item.amount, 0)

  const taxableMonthly = items
    .filter((item) => {
      if (item.salaryComponentId === baseSalaryComponent?.id) return baseSalaryComponent?.isTaxable ?? false
      const component = item.salaryComponentId ? componentsById.get(item.salaryComponentId) : undefined
      return component?.isTaxable ?? false
    })
    .reduce((sum, item) => sum + item.amount, 0)

  const biayaJabatan = Math.min(taxableMonthly * 0.05, 500000)
  const netTaxableMonthly = Math.max(0, taxableMonthly - biayaJabatan)
  const annualTaxable = netTaxableMonthly * 12
  const pkp = Math.max(0, Math.floor((annualTaxable - ptkpAnnualAmount) / 1000) * 1000)
  const annualTax = calculateProgressiveTax(pkp, taxBrackets)
  const pph21 = annualTax / 12

  items.push({ salaryComponentId: null, name: "PPh 21", detail: null, category: "POTONGAN", amount: pph21 })

  const totalDeduction = otherDeductions + pph21
  const netPay = grossPay - totalDeduction

  return {
    gajiPokok,
    gajiPokokSource,
    grossPay,
    totalDeduction,
    pph21,
    netPay,
    items,
  }
}
