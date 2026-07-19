import { prisma } from "@/lib/prisma"
import { countWorkingDays, isoDateUTC } from "@/lib/working-days"

// Pasal 36: sisa cuti tahun berjalan yang tidak dijalani bisa diakumulasi ke
// periode tahun berikutnya, MAKSIMAL 6 hari kerja — sisanya hangus. Akumulasi
// ini cuma boleh dipakai sampai 31 Maret tahun berikutnya, lewat itu hangus
// juga (tidak dobel-akumulasi ke tahun setelahnya lagi).
const CARRY_OVER_MAX_DAYS = 6
const CARRY_OVER_DEADLINE_MONTH = 2 // Maret, 0-indexed
const CARRY_OVER_DEADLINE_DATE = 31

function carryOverGraceDeadline(year: number) {
  return new Date(Date.UTC(year, CARRY_OVER_DEADLINE_MONTH, CARRY_OVER_DEADLINE_DATE, 23, 59, 59))
}

function formatDeadline(year: number) {
  return carryOverGraceDeadline(year).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

function clampToYear(date: Date, boundStart: Date, boundEnd: Date) {
  if (date < boundStart) return boundStart
  if (date > boundEnd) return boundEnd
  return date
}

export type HolidayInRange = { date: string; name: string; isOfficeOpen: boolean }

// Semua hari libur nasional/cuti bersama dalam rentang tahun (inklusif di
// kedua ujung) — dipakai buat menampilkan nama hari libur yang bertepatan
// dengan tanggal cuti yang dipilih pemohon.
export async function getHolidaysInRange(fromYear: number, toYear: number): Promise<HolidayInRange[]> {
  const holidays = await prisma.nationalHoliday.findMany({
    where: {
      date: {
        gte: new Date(Date.UTC(fromYear, 0, 1)),
        lte: new Date(Date.UTC(toYear, 11, 31)),
      },
    },
    select: { date: true, name: true, isOfficeOpen: true },
    orderBy: { date: "asc" },
  })
  return holidays.map((h) => ({ date: isoDateUTC(h.date), name: h.name, isOfficeOpen: h.isOfficeOpen }))
}

// Tanggal hari libur nasional/cuti bersama yang TIDAK ditandai "kantor tetap
// masuk" — dipakai sebagai pengecualian saat menghitung hari kerja cuti.
// Rentang tahun inklusif di kedua ujung.
export async function getHolidayExclusionSet(fromYear: number, toYear: number): Promise<Set<string>> {
  const holidays = await getHolidaysInRange(fromYear, toYear)
  return new Set(holidays.filter((h) => !h.isOfficeOpen).map((h) => h.date))
}

// Hari kerja yang terpakai dari CutiRequest APPROVED yang overlap tahun
// tertentu — dipotong ke rentang tahun itu dulu, baru dihitung hari kerjanya
// (Sabtu/Minggu & hari libur dikecualikan). Dihitung dinamis, bukan
// disimpan, supaya tidak ada dua sumber kebenaran.
function usedWorkingDaysInYear(
  startDate: Date,
  endDate: Date,
  year: number,
  excludedDates: Set<string>
) {
  const yearStart = new Date(Date.UTC(year, 0, 1))
  const yearEnd = new Date(Date.UTC(year, 11, 31))
  const clippedStart = clampToYear(startDate, yearStart, yearEnd)
  const clippedEnd = clampToYear(endDate, yearStart, yearEnd)
  return countWorkingDays(clippedStart, clippedEnd, excludedDates)
}

async function getUsedWorkingDaysByEmployee(year: number, excludedDates: Set<string>) {
  const approvedCuti = await prisma.cutiRequest.findMany({
    where: {
      status: "APPROVED",
      startDate: { lte: new Date(Date.UTC(year, 11, 31)) },
      endDate: { gte: new Date(Date.UTC(year, 0, 1)) },
    },
    select: { employeeId: true, startDate: true, endDate: true },
  })
  const usedByEmployee = new Map<number, number>()
  for (const r of approvedCuti) {
    const days = usedWorkingDaysInYear(r.startDate, r.endDate, year, excludedDates)
    usedByEmployee.set(r.employeeId, (usedByEmployee.get(r.employeeId) ?? 0) + days)
  }
  return usedByEmployee
}

async function getUsedWorkingDaysForEmployee(
  employeeId: number,
  year: number,
  excludedDates: Set<string>
) {
  const approvedCuti = await prisma.cutiRequest.findMany({
    where: {
      employeeId,
      status: "APPROVED",
      startDate: { lte: new Date(Date.UTC(year, 11, 31)) },
      endDate: { gte: new Date(Date.UTC(year, 0, 1)) },
    },
    select: { startDate: true, endDate: true },
  })
  return approvedCuti.reduce(
    (total: number, r: { startDate: Date; endDate: Date }) =>
      total + usedWorkingDaysInYear(r.startDate, r.endDate, year, excludedDates),
    0
  )
}

function computeCarryOver(prevQuota: number, prevAdjustment: number, prevUsed: number) {
  const prevRemaining = Math.max(0, prevQuota + prevAdjustment - prevUsed)
  return Math.min(CARRY_OVER_MAX_DAYS, prevRemaining)
}

// Pasal 38 ayat 3: pegawai yang punya Cuti Besar APPROVED yang overlap tahun
// tertentu kehilangan hak Cuti Tahunan di tahun itu — dicek dinamis di sini,
// bukan disimpan, sama seperti perhitungan "Terpakai" lainnya.
async function getCutiBesarBlockedEmployeeIds(year: number): Promise<Set<number>> {
  const requests = await prisma.cutiBesarRequest.findMany({
    where: {
      status: "APPROVED",
      startDate: { lte: new Date(Date.UTC(year, 11, 31)) },
      endDate: { gte: new Date(Date.UTC(year, 0, 1)) },
    },
    select: { employeeId: true },
  })
  return new Set(requests.map((r) => r.employeeId))
}

async function isCutiBesarBlockedForEmployee(employeeId: number, year: number): Promise<boolean> {
  const count = await prisma.cutiBesarRequest.count({
    where: {
      employeeId,
      status: "APPROVED",
      startDate: { lte: new Date(Date.UTC(year, 11, 31)) },
      endDate: { gte: new Date(Date.UTC(year, 0, 1)) },
    },
  })
  return count > 0
}

export type EmployeeLeaveBalanceRow = {
  employeeId: number
  fullName: string
  departmentName: string
  positionName: string
  year: number
  quota: number
  adjustment: number
  carryOverDays: number // dari sisa tahun sebelumnya, sudah dipotong maks 6 hari
  carryOverActive: boolean // masih berlaku (belum lewat 31 Maret tahun ini)
  carryOverDeadline: string // "31 Mar {year}", buat ditampilkan
  used: number
  remaining: number
  blockedByCutiBesar: boolean // Pasal 38 ayat 3 — Cuti Besar tahun ini menghapus hak Cuti Tahunan
  note: string | null
}

export async function getEmployeeLeaveBalances(year: number): Promise<EmployeeLeaveBalanceRow[]> {
  const excludedDates = await getHolidayExclusionSet(year - 1, year)

  const [employees, balances, prevBalances, usedThisYear, usedPrevYear, cutiBesarBlockedIds] =
    await Promise.all([
      prisma.employee.findMany({
        where: { isActive: true, isDeleted: false },
        select: {
          id: true,
          fullName: true,
          department: { select: { name: true } },
          position: { select: { name: true } },
        },
        orderBy: { fullName: "asc" },
      }),
      prisma.employeeLeaveBalance.findMany({ where: { year } }),
      prisma.employeeLeaveBalance.findMany({ where: { year: year - 1 } }),
      getUsedWorkingDaysByEmployee(year, excludedDates),
      getUsedWorkingDaysByEmployee(year - 1, excludedDates),
      getCutiBesarBlockedEmployeeIds(year),
    ])

  const balanceByEmployee = new Map(balances.map((b) => [b.employeeId, b]))
  const prevBalanceByEmployee = new Map(prevBalances.map((b) => [b.employeeId, b]))

  const now = new Date()
  const carryOverActive = now <= carryOverGraceDeadline(year)
  const deadlineLabel = formatDeadline(year)

  return employees.map((e) => {
    const balance = balanceByEmployee.get(e.id)
    const quota = balance?.quota ?? 12
    const adjustment = balance?.adjustment ?? 0
    const used = usedThisYear.get(e.id) ?? 0

    const prevBalance = prevBalanceByEmployee.get(e.id)
    const prevQuota = prevBalance?.quota ?? 12
    const prevAdjustment = prevBalance?.adjustment ?? 0
    const prevUsed = usedPrevYear.get(e.id) ?? 0
    const carryOverDays = computeCarryOver(prevQuota, prevAdjustment, prevUsed)

    const effectiveCarryOver = carryOverActive ? carryOverDays : 0
    const blockedByCutiBesar = cutiBesarBlockedIds.has(e.id)

    return {
      employeeId: e.id,
      fullName: e.fullName,
      departmentName: e.department.name,
      positionName: e.position.name,
      year,
      quota,
      adjustment,
      carryOverDays,
      carryOverActive,
      carryOverDeadline: deadlineLabel,
      used,
      remaining: blockedByCutiBesar ? 0 : quota + adjustment + effectiveCarryOver - used,
      blockedByCutiBesar,
      note: balance?.note ?? null,
    }
  })
}

// Versi satu pegawai — dipakai buat validasi saldo saat mengajukan cuti dan
// buat menampilkan sisa saldo di form pengajuan, tanpa perlu query semua
// pegawai seperti getEmployeeLeaveBalances.
export async function getEmployeeLeaveBalance(
  employeeId: number,
  year: number
): Promise<Omit<EmployeeLeaveBalanceRow, "fullName" | "departmentName" | "positionName">> {
  const excludedDates = await getHolidayExclusionSet(year - 1, year)

  const [balance, prevBalance, used, prevUsed, blockedByCutiBesar] = await Promise.all([
    prisma.employeeLeaveBalance.findUnique({
      where: { employeeId_year: { employeeId, year } },
    }),
    prisma.employeeLeaveBalance.findUnique({
      where: { employeeId_year: { employeeId, year: year - 1 } },
    }),
    getUsedWorkingDaysForEmployee(employeeId, year, excludedDates),
    getUsedWorkingDaysForEmployee(employeeId, year - 1, excludedDates),
    isCutiBesarBlockedForEmployee(employeeId, year),
  ])

  const quota = balance?.quota ?? 12
  const adjustment = balance?.adjustment ?? 0
  const prevQuota = prevBalance?.quota ?? 12
  const prevAdjustment = prevBalance?.adjustment ?? 0
  const carryOverDays = computeCarryOver(prevQuota, prevAdjustment, prevUsed)

  const now = new Date()
  const carryOverActive = now <= carryOverGraceDeadline(year)
  const effectiveCarryOver = carryOverActive ? carryOverDays : 0

  return {
    employeeId,
    year,
    quota,
    adjustment,
    carryOverDays,
    carryOverActive,
    carryOverDeadline: formatDeadline(year),
    used,
    remaining: blockedByCutiBesar ? 0 : quota + adjustment + effectiveCarryOver - used,
    blockedByCutiBesar,
    note: balance?.note ?? null,
  }
}
