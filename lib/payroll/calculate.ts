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
//   lihat `attendanceRatePerDay`) × `attendanceAllowanceDays` — SEKARANG
//   SELALU STANDARD_WORK_DAYS penuh (lihat lib/payroll/attendance-allowance.ts),
//   TIDAK PERNAH dikurangi lagi di komponen Pendapatan ini walau ada
//   Mangkir/Cuti Besar/CDT/Pulang Cepat<12:00. File ini SENGAJA tidak tahu
//   apa-apa soal absensi/izin — cuma menerima angka hari jadi yang tinggal
//   dikalikan, biar logika absensinya terpusat di satu tempat. TIDAK perlu
//   di-assign manual di EmployeeSalaryComponent (sama seperti Gaji Pokok,
//   otomatis untuk semua pegawai yang jabatannya punya rate).
// - Komponen bertipe KEHADIRAN kategori POTONGAN (mis. "Pot.
//   Kehadiran/Punishment") dihitung otomatis = rate per hari yang SAMA ×
//   `attendanceAllowanceUncoveredDays` (Cuti Besar/CDT/Pulang Cepat<12:00/
//   Mangkir) — INILAH tempat potongan kehadiran ditulis (dipisah dari
//   Pendapatan) supaya jumlah Penerimaan/Bruto yang jadi dasar PPh 21 & BPJS
//   TIDAK ikut berkurang gara-gara mangkir. Komponen ini JUGA bisa ditambah
//   nominal manual (lewat PayrollManualEntry, sama seperti MANUAL_PERIODE)
//   buat punishment di luar data absensi (mis. SP) — nilainya DITAMBAHKAN ke
//   hasil otomatis, bukan menggantikan.
// - Komponen bertipe MANUAL_PERIODE (Lembur, Insentif, SPPD, Kredit, dst.) bisa
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

export type PayrollTerRateDef = {
  minIncome: number // penghasilan bruto BULANAN dari (Rp) — beda dari TaxBracket yang tahunan
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
  taxableMonthly: number // dasar pengenaan pajak bulan ini — DISIMPAN ke Payslip.taxableMonthly buat rekonsiliasi akhir tahun/resign nanti
}

function formatRupiahShort(value: number) {
  return `Rp${Math.round(value).toLocaleString("id-ID")}`
}

// Detail baris "Pot. Kehadiran/Punishment" (Potongan) — rincian hari yang
// TIDAK ditanggung (jenis izin yang di-toggle "Mengurangi Tunjangan
// Kehadiran" di Pengaturan Izin, plus Mangkir yang selalu mengurangi) × rate
// yang sama dengan Tunjangan Kehadiran, plus baris tambahan manual kalau
// admin mengisi nominal ekstra (mis. SP/pelanggaran di luar data absensi).
function formatAttendancePunishmentDetail(
  breakdown: AttendanceAllowanceBreakdown,
  punishmentDays: number,
  ratePerDay: number,
  manualAmount: number
): string {
  const deductions = [
    ...breakdown.uncoveredByType.map((t) => [t.label, t.days] as const),
    ["Mangkir", breakdown.mangkirDays] as const,
  ]
  const activeDeductions = deductions.filter(([, count]) => count > 0)

  const lines = [
    `Standar ${breakdown.standardDays} hari`,
    activeDeductions.length > 0
      ? `Potongan: ${activeDeductions.map(([label, count]) => `${label} ${count}`).join(", ")}`
      : "Potongan: tidak ada",
    `= ${punishmentDays} hari × ${formatRupiahShort(ratePerDay)}`,
    manualAmount > 0 ? `Tambahan manual (SP/lainnya): ${formatRupiahShort(manualAmount)}` : null,
    breakdown.holidayDaysExcluded > 0
      ? `Hari kerja periode ini (21-20): ${breakdown.totalWorkDaysInPeriod} hari (${breakdown.holidayDaysExcluded} hari libur nasional dikecualikan)`
      : `Hari kerja periode ini (21-20): ${breakdown.totalWorkDaysInPeriod} hari`,
    `Tap mesin (referensi): ${breakdown.presentDaysRaw} hari hadir`,
  ]

  return lines.filter((line): line is string => line !== null).join("\n")
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

// PPh 21 bulanan (metode gross biasa) dari SATU angka penghasilan bruto kena
// pajak bulanan — dipakai berulang oleh metode GROSS_UP di bawah (tiap
// iterasi butuh menghitung ulang pajaknya dari basis yang berubah).
function calculateMonthlyPph21(
  taxableMonthly: number,
  ptkpAnnualAmount: number,
  taxBrackets: PayrollTaxBracketDef[]
): number {
  const biayaJabatan = Math.min(taxableMonthly * 0.05, 500000)
  const netTaxableMonthly = Math.max(0, taxableMonthly - biayaJabatan)
  const annualTaxable = netTaxableMonthly * 12
  const pkp = Math.max(0, Math.floor((annualTaxable - ptkpAnnualAmount) / 1000) * 1000)
  const annualTax = calculateProgressiveTax(pkp, taxBrackets)
  return annualTax / 12
}

// TER (Tarif Efektif Rata-rata, PMK 168/2023): PPh 21 = Bruto bulan ini ×
// tarif dari lapisan yang cocok (lapisan bruto BULANAN, beda dari
// TaxBracket progresif yang tahunan). Kalau tidak ada lapisan yang cocok
// (tabel TER kategori ini belum diisi admin), dianggap 0 — bukan
// error/exception, biar generate payslip tidak berhenti total gara-gara
// data referensi kosong (warning-nya ditangani di pemanggil).
function calculateMonthlyPph21Ter(bruto: number, terRates: PayrollTerRateDef[]): number {
  const match = terRates.find((r) => bruto >= r.minIncome && (r.maxIncome === null || bruto <= r.maxIncome))
  if (!match) return 0
  return (bruto * match.ratePercent) / 100
}

export type FinalPeriodReconciliation = {
  finalPph21: number // bisa NEGATIF (lebih bayar → jadi kembalian, netPay lebih besar bulan ini, BUKAN dipotong)
  annualTaxableSum: number
  biayaJabatanAnnual: number
  pkp: number
  annualTaxTerutang: number
  priorMonthsPph21Sum: number
}

// Rekonsiliasi PPh 21 masa pajak TERAKHIR (Desember, atau bulan
// resign/pensiun) buat pegawai yang bulanan pakai TER — sesuai PP 58/2023 &
// PMK 168/2023: TER cuma berlaku Januari s/d bulan SEBELUM masa pajak
// terakhir, masa pajak terakhir WAJIB dihitung ulang dari NOL pakai tarif
// progresif Pasal 17 atas total penghasilan SETAHUN PENUH (bukan TER lagi),
// baru dikurangi PPh 21 yang sudah dipotong (via TER) bulan-bulan
// sebelumnya. Beda dari calculateMonthlyPph21 (yang men-setahunkan SATU
// bulan lalu dibagi 12 lagi — estimasi berjalan), fungsi ini pakai angka
// AKTUAL yang sudah terjadi (priorMonthsTaxableSum, dari Payslip.taxableMonthly
// yang tersimpan tiap bulan), bukan estimasi.
function calculateFinalPeriodPph21(
  taxableMonthlyThisPeriod: number,
  priorMonthsTaxableSum: number,
  priorMonthsPph21Sum: number,
  ptkpAnnualAmount: number,
  taxBrackets: PayrollTaxBracketDef[]
): FinalPeriodReconciliation {
  const annualTaxableSum = priorMonthsTaxableSum + taxableMonthlyThisPeriod
  // Biaya jabatan disetahunkan langsung (bukan dijumlah dari 12 nilai bulanan
  // yang masing-masing sudah dibatasi Rp500rb) — batas tahunannya Rp6.000.000
  // (=12 × Rp500rb), sama saja hasilnya kalau penghasilan tiap bulan stabil,
  // tapi ini yang benar kalau penghasilannya naik-turun antar bulan.
  const biayaJabatanAnnual = Math.min(annualTaxableSum * 0.05, 6000000)
  const netAnnualTaxable = Math.max(0, annualTaxableSum - biayaJabatanAnnual)
  const pkp = Math.max(0, Math.floor((netAnnualTaxable - ptkpAnnualAmount) / 1000) * 1000)
  const annualTaxTerutang = calculateProgressiveTax(pkp, taxBrackets)
  return {
    finalPph21: annualTaxTerutang - priorMonthsPph21Sum,
    annualTaxableSum,
    biayaJabatanAnnual,
    pkp,
    annualTaxTerutang,
    priorMonthsPph21Sum,
  }
}

// Detail baris "PPh 21 (Rekonsiliasi Akhir Tahun)" — transparan soal
// darimana angka finalnya berasal, penting karena bisa jadi POTONGAN
// (kurang bayar) ATAU MALAH NAMBAH netPay (lebih bayar/restitusi).
function formatFinalPeriodPph21Detail(r: FinalPeriodReconciliation, monthsCovered: number): string {
  const lines = [
    `Rekonsiliasi Pasal 17 (${monthsCovered} bulan penghasilan disetahunkan)`,
    `Total bruto kena pajak: ${formatRupiahShort(r.annualTaxableSum)}`,
    `Biaya jabatan setahun: ${formatRupiahShort(r.biayaJabatanAnnual)}`,
    `PKP: ${formatRupiahShort(r.pkp)}`,
    `PPh 21 terutang setahun: ${formatRupiahShort(r.annualTaxTerutang)}`,
    `Sudah dipotong (TER bulan sebelumnya): ${formatRupiahShort(r.priorMonthsPph21Sum)}`,
    r.finalPph21 >= 0
      ? `= Kurang bayar bulan ini: ${formatRupiahShort(r.finalPph21)}`
      : `= Lebih bayar (dikembalikan): ${formatRupiahShort(Math.abs(r.finalPph21))}`,
  ]
  return lines.join("\n")
}

// Metode Gross-Up: perusahaan kasih "Tunjangan PPh 21" senilai PERSIS
// pajaknya sendiri, supaya take-home pay pegawai tidak berkurang gara-gara
// pajak — tapi tunjangan itu sendiri kena pajak juga (soalnya jadi
// penghasilan), jadi harus dicari titik keseimbangannya: allowance yang,
// kalau ditambahkan ke penghasilan kena pajak, menghasilkan PPh 21 senilai
// allowance itu sendiri persis. Dicari lewat iterasi (bukan rumus lapisan
// tertutup) SENGAJA supaya otomatis mengikuti berapa pun jumlah/susunan
// TaxBracket yang di-custom admin (lihat halaman Pajak & BPJS), bukan
// hardcode 5 lapisan UU HPP. Konvergen cepat karena tarif pajak < 100%.
function calculateGrossUpAllowance(
  taxableMonthlyBeforeAllowance: number,
  ptkpAnnualAmount: number,
  taxBrackets: PayrollTaxBracketDef[]
): number {
  let allowance = 0
  for (let i = 0; i < 30; i++) {
    const nextAllowance = calculateMonthlyPph21(
      taxableMonthlyBeforeAllowance + allowance,
      ptkpAnnualAmount,
      taxBrackets
    )
    if (Math.abs(nextAllowance - allowance) < 1) {
      allowance = nextAllowance
      break
    }
    allowance = nextAllowance
  }
  return allowance
}

export type AttendanceAllowanceBreakdown = {
  standardDays: number
  mangkirDays: number
  presentDaysRaw: number
  totalWorkDaysInPeriod: number
  holidayDaysExcluded: number
  uncoveredByType: { leaveType: string; label: string; days: number }[]
  coveredByType: { leaveType: string; label: string; days: number }[]
}

export type Pph21Method = "GROSS" | "GROSS_UP" | "NET" | "TER"

export function calculatePayslip(params: {
  components: PayrollComponentDef[]
  assignments: PayrollAssignmentDef[]
  manualEntries: PayrollManualEntryDef[]
  golonganRate: number | null // hasil lookup SalaryGradeRate untuk golongan+step+versi aktif pegawai ini, null kalau tidak ketemu
  attendanceAllowanceDays: number // dari computeAttendanceAllowanceDays — SELALU STANDARD_WORK_DAYS penuh, dipakai buat komponen Pendapatan "Tunjangan Kehadiran"
  attendanceAllowanceUncoveredDays: number // dari computeAttendanceAllowanceDays.uncoveredDays — hari Cuti Besar/CDT/Pulang Cepat<12:00/Mangkir, dipakai buat komponen Potongan "Pot. Kehadiran/Punishment"
  attendanceAllowanceBreakdown: AttendanceAllowanceBreakdown | null // buat ditampilkan sebagai detail rumus, null kalau komponen kehadirannya tidak aktif
  attendanceRatePerDay: number | null // rate/hari dari Position pegawai, null = jabatannya tidak dapat tunjangan kehadiran
  ptkpAnnualAmount: number
  taxBrackets: PayrollTaxBracketDef[]
  pph21Method: Pph21Method // default GROSS kalau belum diatur admin (lihat BpjsSettings.pph21Method)
  terRates: PayrollTerRateDef[] // lapisan tarif TER kategori pegawai ini (A/B/C, sudah dicocokkan dari PTKP status di pemanggil) — cuma dipakai kalau pph21Method === "TER"
  // Rekonsiliasi akhir tahun/resign (PP 58/2023 & Pasal 17) — cuma relevan
  // kalau pph21Method === "TER". isFinalTaxPeriod ditentukan pemanggil
  // (server/actions/payroll-period.ts): true kalau periode ini bulan
  // Desember ATAU mengandung Employee.resignDate. priorMonths*Sum dijumlah
  // dari Payslip Jan..bulan sebelumnya TAHUN INI (0 kalau belum ada data —
  // itu valid, bukan error, mis. pegawai baru masuk sistem pertengahan
  // tahun; hasilnya cuma jadi kurang akurat, bukan salah/crash).
  isFinalTaxPeriod: boolean
  priorMonthsTaxableSum: number
  priorMonthsPph21Sum: number
  priorMonthsCovered: number // berapa bulan yang datanya ketemu — buat ditampilkan di detail, transparansi kalau datanya tidak lengkap
}): PayrollCalculationResult {
  const {
    components,
    assignments,
    manualEntries,
    golonganRate,
    attendanceAllowanceDays,
    attendanceAllowanceUncoveredDays,
    attendanceAllowanceBreakdown,
    attendanceRatePerDay,
    ptkpAnnualAmount,
    taxBrackets,
    pph21Method,
    terRates,
    isFinalTaxPeriod,
    priorMonthsTaxableSum,
    priorMonthsPph21Sum,
    priorMonthsCovered,
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

  function isAttendancePunishment(component: PayrollComponentDef) {
    return (
      component.calculationType === "KEHADIRAN" &&
      component.category === "POTONGAN" &&
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
    } else if (isAttendancePunishment(component)) {
      // Otomatis dari data absensi + tambahan manual (SP/lainnya) kalau ada — ADITIF, bukan menggantikan.
      value = (attendanceRatePerDay ?? 0) * attendanceAllowanceUncoveredDays + (manualEntryByComponentId.get(componentId) ?? 0)
    } else {
      const assignment = assignmentByComponentId.get(componentId)
      if (assignment?.isActive) {
        if (component.calculationType === "NOMINAL_TETAP") {
          value = assignment.amount ?? 0
        } else if (component.calculationType === "PERSENTASE") {
          const base = component.baseComponentId ? resolve(component.baseComponentId) : 0
          value = ((component.percentageValue ?? 0) / 100) * base
        }
        // KEHADIRAN kategori PINJAMAN sengaja tetap 0 — aturannya belum didefinisikan.
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
    const isIncluded =
      isAttendanceEarning(component) || isAttendancePunishment(component)
        ? true
        : component.calculationType === "MANUAL_PERIODE"
          ? manualEntryByComponentId.has(component.id)
          : (assignmentByComponentId.get(component.id)?.isActive ?? false)
    if (!isIncluded) continue

    let detail: string | null = null
    if (isAttendancePunishment(component) && attendanceAllowanceBreakdown) {
      detail = formatAttendancePunishmentDetail(
        attendanceAllowanceBreakdown,
        attendanceAllowanceUncoveredDays,
        attendanceRatePerDay ?? 0,
        manualEntryByComponentId.get(component.id) ?? 0
      )
    }

    items.push({
      salaryComponentId: component.id,
      name: component.name,
      detail,
      category: component.category,
      amount: resolve(component.id),
    })
  }

  const taxableMonthly = items
    .filter((item) => {
      if (item.salaryComponentId === baseSalaryComponent?.id) return baseSalaryComponent?.isTaxable ?? false
      const component = item.salaryComponentId ? componentsById.get(item.salaryComponentId) : undefined
      return component?.isTaxable ?? false
    })
    .reduce((sum, item) => sum + item.amount, 0)

  // Gross-Up: Tunjangan PPh 21 ditambahkan sebagai PENDAPATAN dulu (ikut
  // masuk grossPay) SEBELUM grossPay dihitung — nilainya persis sama dengan
  // PPh 21 hasil akhir (lihat calculateGrossUpAllowance), jadi efek bersih
  // ke netPay pegawai nol (take-home pay tidak berkurang gara-gara pajak).
  let grossUpAllowance = 0
  if (pph21Method === "GROSS_UP") {
    grossUpAllowance = calculateGrossUpAllowance(taxableMonthly, ptkpAnnualAmount, taxBrackets)
    items.push({
      salaryComponentId: null,
      name: "Tunjangan PPh 21 (Gross-Up)",
      detail: null,
      category: "PENDAPATAN_TIDAK_TETAP",
      amount: grossUpAllowance,
    })
  }

  const grossPay = items
    .filter((item) => item.category === "PENDAPATAN_TETAP" || item.category === "PENDAPATAN_TIDAK_TETAP")
    .reduce((sum, item) => sum + item.amount, 0)

  const otherDeductions = items
    .filter((item) => item.category === "POTONGAN" || item.category === "PINJAMAN")
    .reduce((sum, item) => sum + item.amount, 0)

  // Masa pajak terakhir (Desember/resign) buat pegawai TER WAJIB direkonsiliasi
  // pakai Pasal 17 dari total setahun (lihat calculateFinalPeriodPph21) —
  // TER tidak berlaku lagi bulan ini, sesuai PP 58/2023 & PMK 168/2023.
  const isReconciling = pph21Method === "TER" && isFinalTaxPeriod
  const reconciliation = isReconciling
    ? calculateFinalPeriodPph21(taxableMonthly, priorMonthsTaxableSum, priorMonthsPph21Sum, ptkpAnnualAmount, taxBrackets)
    : null

  const pph21 = reconciliation
    ? reconciliation.finalPph21
    : pph21Method === "GROSS_UP"
      ? grossUpAllowance
      : pph21Method === "TER"
        ? calculateMonthlyPph21Ter(taxableMonthly, terRates)
        : calculateMonthlyPph21(taxableMonthly, ptkpAnnualAmount, taxBrackets)

  const pph21Name = reconciliation
    ? "PPh 21 (Rekonsiliasi Akhir Tahun)"
    : pph21Method === "GROSS_UP"
      ? "PPh 21 (Gross-Up)"
      : pph21Method === "NET"
        ? "PPh 21 (Ditanggung Perusahaan)"
        : pph21Method === "TER"
          ? "PPh 21 (TER)"
          : "PPh 21"
  const pph21Detail = reconciliation
    ? formatFinalPeriodPph21Detail(reconciliation, priorMonthsCovered + 1)
    : null
  items.push({ salaryComponentId: null, name: pph21Name, detail: pph21Detail, category: "POTONGAN", amount: pph21 })

  // Metode NET: perusahaan menanggung penuh PPh 21 — dihitung & ditampilkan
  // buat pelaporan, tapi TIDAK ikut memotong netPay pegawai.
  const totalDeduction = otherDeductions + (pph21Method === "NET" ? 0 : pph21)
  const netPay = grossPay - totalDeduction

  return {
    gajiPokok,
    gajiPokokSource,
    grossPay,
    totalDeduction,
    pph21,
    netPay,
    items,
    taxableMonthly,
  }
}
