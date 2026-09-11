"use server"

import { revalidatePath } from "next/cache"

import { Prisma, type SalaryComponentCategory } from "@prisma/client"
import ExcelJS from "exceljs"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity-log"
import { createNotificationForUsers } from "@/lib/notifications"
import { formatPeriodLabel } from "@/lib/month-names"
import { payrollPeriodSchema, payrollPeriodRejectionSchema } from "@/lib/validations/payroll-period"
import { calculatePayslip, type PayrollComponentDef, type PayrollTerRateDef } from "@/lib/payroll/calculate"
import { computeAttendanceAllowanceDays } from "@/lib/payroll/attendance-allowance"
import {
  getActiveApprovalStep,
  getPayrollFlowConfig,
  notifyApproverTurn,
  startPayrollApproval,
} from "@/lib/payroll/approval-flow"
import { TER_CATEGORY_BY_PTKP_STATUS } from "@/lib/validations/payroll-tax"

export type PayrollPeriodState = { error?: string } | undefined
export type GeneratePayslipsState =
  | { success: true; generated: number; warnings: string[] }
  | { success: false; error: string }
  | undefined

const LIST_PATH = "/admin/payroll/proses"

function detailPath(id: number) {
  return `${LIST_PATH}/${id}`
}

// Cut-off dari PayrollSettings.cutoffDay (default 21, admin bisa ubah di
// Pengaturan Payroll) — `month`/`year` merujuk bulan PEMBAYARAN (bulan
// tanggal cutoffDay-1-nya), bukan bulan mulai cut-off. Cuma dipakai saat
// BUAT periode baru — periode yang sudah ada TIDAK ikut berubah kalau
// cutoffDay diubah belakangan (tanggalnya sudah disimpan eksplisit).
async function computePeriodDates(year: number, month: number) {
  const settings = await prisma.payrollSettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } })
  const cutoffDay = settings.cutoffDay
  const periodEnd = new Date(Date.UTC(year, month - 1, cutoffDay - 1))
  const periodStart = new Date(Date.UTC(year, month - 2, cutoffDay))
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
  const { periodStart, periodEnd } = await computePeriodDates(year, month)

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
  if (period.status !== "DRAFT") {
    return { error: "Cuma periode berstatus Draft yang bisa dihapus." }
  }
  await prisma.payrollPeriod.delete({ where: { id } })
  await logPeriod("DELETE", `${period.month}/${period.year}`)
  revalidatePath(LIST_PATH)
  return undefined
}

// Diajukan HR_ADMIN setelah payslip di-generate — periode dibekukan
// (generate/isi manual tidak bisa lagi) sampai SUPER_ADMIN approve/tolak.
// rejectionReason SENGAJA tidak direset di sini — biar HR_ADMIN masih lihat
// alasan penolakan terakhir sebagai konteks kalau ini pengajuan ulang.
export async function submitPayrollApprovalAction(id: number): Promise<PayrollPeriodState> {
  const session = await auth()
  // Role DIPERIKSA di sini, bukan sekadar menggantungkan diri pada penjaga
  // rute /admin/** di proxy.ts — server action bisa di-POST ke path mana pun,
  // jadi penjaga path saja tidak menutup jalur itu. (Aksi ini sebelumnya sama
  // sekali tidak memeriksa pemanggilnya, beda sendiri dari aksi payroll lain.)
  const role = session?.user.role
  if (!session?.user || (role !== "SUPER_ADMIN" && role !== "HR_ADMIN")) {
    return { error: "Anda tidak berhak mengajukan periode payroll." }
  }

  const period = await prisma.payrollPeriod.findUnique({
    where: { id },
    include: { _count: { select: { payslips: true } } },
  })
  if (!period) return { error: "Periode tidak ditemukan." }
  if (period.status !== "DRAFT") {
    return { error: "Periode ini bukan status Draft." }
  }
  if (period._count.payslips === 0) {
    return { error: "Generate payslip dulu sebelum mengajukan approval." }
  }

  const started = await prisma.$transaction(async (tx) => {
    const result = await startPayrollApproval(tx, id, "LOCK")
    await tx.payrollPeriod.update({
      where: { id },
      data: {
        status: "PENDING_APPROVAL",
        submittedForApprovalAt: new Date(),
        submittedForApprovalBy: session.user.username,
      },
    })
    return result
  })

  await logPeriod("UPDATE", `${period.month}/${period.year} (diajukan approval)`)
  // Alur belum diatur = perilaku lama dipertahankan (keputusan langsung di
  // tangan SUPER_ADMIN lewat tombol Setujui), tidak ada penyetuju yang perlu
  // dikabari.
  if (started.configured) {
    await notifyApproverTurn(started.firstApproverEmployeeId, period, "LOCK")
  }
  revalidatePath(LIST_PATH)
  revalidatePath(detailPath(id))
  return undefined
}

// Kabari pegawai bahwa slip gajinya sudah bisa dilihat. SENGAJA dipicu saat
// periode jadi LOCKED, BUKAN saat payslip di-generate/diimpor — selama masih
// DRAFT, payslip bisa ditimpa ulang dan halaman Slip Gaji pegawai pun belum
// menampilkannya sama sekali (app/pegawai/slip-gaji/page.tsx cuma query
// periode berstatus LOCKED). Best-effort: kegagalan notifikasi tidak boleh
// membatalkan approval yang sudah tersimpan.
//
// `isCorrection` = periode ini SUDAH pernah dipublikasikan sebelumnya lalu
// dibuka kunci & diperbaiki (lihat PayrollPeriod.publishedAt). Pesannya
// dibedakan karena pegawai kemungkinan sudah terlanjur melihat slip versi
// lama — kalau teksnya tetap "sudah terbit", mereka tidak punya petunjuk
// bahwa nominalnya berubah.
async function notifyPayslipsPublished(
  period: { id: number; month: number; year: number },
  isCorrection: boolean
) {
  const payslips = await prisma.payslip.findMany({
    where: { payrollPeriodId: period.id },
    select: { employee: { select: { user: { select: { id: true } } } } },
  })
  // Pegawai yang belum punya akun login otomatis tersaring di sini — tidak
  // ada user yang bisa dikirimi notifikasi/push untuk mereka.
  const userIds = payslips.map((p) => p.employee.user?.id).filter((id): id is number => id !== undefined)

  const label = formatPeriodLabel(period.month, period.year)
  await createNotificationForUsers(userIds, {
    title: isCorrection ? "Slip Gaji Diperbarui" : "Slip Gaji Tersedia",
    message: isCorrection
      ? `Slip gaji periode ${label} telah diperbaiki oleh admin. Silakan cek kembali rincian terbarunya.`
      : `Slip gaji periode ${label} sudah terbit dan bisa Anda lihat sekarang.`,
    link: "/pegawai/slip-gaji",
  })
}

// Approve = langsung kunci (LOCKED) — tidak ada state APPROVED terpisah,
// lihat diskusi di PayrollPeriodStatus.
//
// DUA peran sekaligus, tergantung alur approval sudah diatur atau belum:
//   - Belum diatur → ini jalur NORMAL (perilaku lama): SUPER_ADMIN memutuskan
//     langsung, tidak ada penyetuju berjenjang.
//   - Sudah diatur → ini OVERRIDE DARURAT: SUPER_ADMIN melangkahi penyetuju
//     yang ditunjuk (mis. penyetujunya berhalangan lama). Alasan WAJIB diisi,
//     step yang dilangkahi ditandai SKIPPED beserta alasannya, dan
//     overrideCount naik supaya terlihat saat audit.
export async function approvePayrollPeriodAction(
  id: number,
  overrideReason?: string
): Promise<PayrollPeriodState> {
  const session = await auth()
  if (session?.user.role !== "SUPER_ADMIN") {
    return { error: "Cuma Super Admin yang bisa menyetujui periode payroll." }
  }
  const period = await prisma.payrollPeriod.findUnique({ where: { id } })
  if (!period) return { error: "Periode tidak ditemukan." }
  if (period.status !== "PENDING_APPROVAL") {
    return { error: "Periode ini tidak sedang menunggu approval." }
  }

  const pendingStep = await getActiveApprovalStep(id)
  const isOverride = pendingStep !== null
  const reason = overrideReason?.trim() ?? ""
  if (isOverride && reason.length < 5) {
    return {
      error:
        "Periode ini sedang menunggu penyetuju yang ditunjuk. Untuk melangkahinya, isi alasan override darurat (minimal 5 karakter).",
    }
  }

  // publishedAt diisi CUMA kalau masih kosong — approve berikutnya (setelah
  // periode sempat dibuka kunci & diperbaiki) tidak boleh menimpanya, karena
  // nilainya dipakai sebagai penanda permanen "pegawai sudah pernah melihat
  // slip periode ini".
  const isCorrection = period.publishedAt !== null
  await prisma.$transaction(async (tx) => {
    if (isOverride) {
      await tx.payrollApprovalStep.updateMany({
        where: { payrollPeriodId: id, stage: "LOCK", round: pendingStep.round, status: { in: ["IN_PROGRESS", "WAITING"] } },
        data: {
          status: "SKIPPED",
          notes: `Dilangkahi override darurat oleh ${session.user.username}: ${reason}`,
          actedAt: new Date(),
        },
      })
    }
    await tx.payrollPeriod.update({
      where: { id },
      data: {
        status: "LOCKED",
        lockedAt: new Date(),
        lockedBy: session.user.username,
        rejectionReason: null,
        ...(isCorrection ? {} : { publishedAt: new Date() }),
        ...(isOverride ? { overrideCount: { increment: 1 } } : {}),
      },
    })
  })
  await logPeriod(
    "UPDATE",
    `${period.month}/${period.year} (${
      isOverride
        ? `OVERRIDE DARURAT — melangkahi penyetuju yang ditunjuk, alasan: ${reason}`
        : isCorrection
          ? "koreksi disetujui & dikunci ulang"
          : "disetujui & dikunci"
    })`
  )
  // try/catch WAJIB di sini, bukan sekadar "best-effort" di dalam
  // notifyPayslipsPublished: periode SUDAH ter-update jadi LOCKED di atas dan
  // tidak ada transaksi yang me-rollback-nya. Kalau query di jalur notifikasi
  // melempar error, tanpa penjagaan ini seluruh action ikut gagal — admin
  // melihat error padahal approval-nya sebenarnya sukses, lalu mencoba lagi
  // dan malah kena guard "Periode ini tidak sedang menunggu approval."
  try {
    await notifyPayslipsPublished(period, isCorrection)
  } catch (err) {
    console.error("Gagal mengirim notifikasi slip gaji terbit:", err)
  }
  revalidatePath(LIST_PATH)
  revalidatePath(detailPath(id))
  return undefined
}

export type PayrollRejectionState = { error?: string } | undefined

// Balik ke DRAFT supaya HR_ADMIN bisa perbaiki lalu ajukan ulang.
export async function rejectPayrollApprovalAction(
  id: number,
  _prevState: PayrollRejectionState,
  formData: FormData
): Promise<PayrollRejectionState> {
  const session = await auth()
  if (session?.user.role !== "SUPER_ADMIN") {
    return { error: "Cuma Super Admin yang bisa menolak periode payroll." }
  }
  const parsed = payrollPeriodRejectionSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Alasan penolakan wajib diisi." }
  }
  const period = await prisma.payrollPeriod.findUnique({ where: { id } })
  if (!period) return { error: "Periode tidak ditemukan." }
  if (period.status !== "PENDING_APPROVAL") {
    return { error: "Periode ini tidak sedang menunggu approval." }
  }

  await prisma.payrollPeriod.update({
    where: { id },
    data: {
      status: "DRAFT",
      submittedForApprovalAt: null,
      submittedForApprovalBy: null,
      rejectionReason: parsed.data.rejectionReason,
    },
  })
  await logPeriod("UPDATE", `${period.month}/${period.year} (approval ditolak)`)
  revalidatePath(LIST_PATH)
  revalidatePath(detailPath(id))
  return undefined
}

// Buka kunci LANGSUNG oleh SUPER_ADMIN, tanpa lewat alur persetujuan koreksi.
//
// Kalau alur UNLOCK sudah diatur, jalur normalnya adalah HR_ADMIN menekan
// "Ajukan Koreksi" (requestPayrollUnlockAction) dan penyetuju yang memutuskan.
// Aksi ini jadi OVERRIDE DARURAT untuk saat penyetujunya berhalangan lama —
// karena itu alasannya WAJIB, dicatat mencolok, dan overrideCount naik.
// Membuka kunci TIDAK menaikkan correctionCount: yang dihitung sebagai
// "koreksi" adalah perbaikan yang benar-benar selesai & dikunci ulang, bukan
// sekadar periodenya sempat dibuka.
export async function unlockPayrollPeriodAction(
  id: number,
  overrideReason?: string
): Promise<PayrollPeriodState> {
  const session = await auth()
  if (session?.user.role !== "SUPER_ADMIN") {
    return { error: "Cuma Super Admin yang bisa membuka kunci periode payroll." }
  }
  const period = await prisma.payrollPeriod.findUnique({ where: { id } })
  if (!period) return { error: "Periode tidak ditemukan." }

  // Override dianggap perlu kalau alur koreksi memang sudah dikonfigurasi —
  // artinya organisasi ini sudah memutuskan koreksi harus lewat persetujuan.
  const unlockFlow = await getPayrollFlowConfig("UNLOCK")
  const isOverride = unlockFlow.length > 0
  const reason = overrideReason?.trim() ?? ""
  if (isOverride && reason.length < 5) {
    return {
      error:
        "Koreksi payroll seharusnya lewat \"Ajukan Koreksi\" agar disetujui pejabat yang ditunjuk. Untuk membuka paksa, isi alasan override darurat (minimal 5 karakter).",
    }
  }

  const pendingStep = await getActiveApprovalStep(id)
  await prisma.$transaction(async (tx) => {
    if (pendingStep) {
      await tx.payrollApprovalStep.updateMany({
        where: { payrollPeriodId: id, round: pendingStep.round, status: { in: ["IN_PROGRESS", "WAITING"] } },
        data: {
          status: "SKIPPED",
          notes: `Dilangkahi override darurat oleh ${session.user.username}: ${reason}`,
          actedAt: new Date(),
        },
      })
    }
    await tx.payrollPeriod.update({
      where: { id },
      data: {
        status: "DRAFT",
        lockedAt: null,
        lockedBy: null,
        submittedForApprovalAt: null,
        submittedForApprovalBy: null,
        ...(isOverride ? { overrideCount: { increment: 1 } } : {}),
      },
    })
  })
  await logPeriod(
    "UPDATE",
    `${period.month}/${period.year} (${
      isOverride ? `dibuka kunci lewat OVERRIDE DARURAT — alasan: ${reason}` : "dibuka kunci"
    })`
  )
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
  if (period.status === "PENDING_APPROVAL") {
    return { success: false, error: "Periode sedang menunggu approval, tidak bisa digenerate ulang." }
  }

  const [activeVersion, components, ptkpRates, taxBrackets, terRateRows, employees, manualEntryRows, bpjsSettings] =
    await Promise.all([
      prisma.salaryScaleVersion.findFirst({ where: { isActive: true } }),
      prisma.salaryComponent.findMany({ where: { isActive: true } }),
      prisma.ptkpRate.findMany(),
      prisma.taxBracket.findMany(),
      prisma.terRate.findMany(),
      prisma.employee.findMany({
        // Pegawai aktif normal, ATAU sudah di-soft-delete (resign) TAPI
        // tanggal resign-nya masih di/setelah awal periode ini — biar
        // payslip masa pajak terakhirnya (rekonsiliasi Pasal 17) tetap
        // kebentuk walau akunnya sudah dinonaktifkan duluan (lihat
        // softDeleteEmployeeAction). Periode SETELAH bulan resign otomatis
        // tidak lagi memenuhi syarat ini, jadi pegawainya otomatis
        // "hilang" dari situ — tidak perlu exclude manual.
        where: {
          OR: [
            { isActive: true, isDeleted: false },
            { resignDate: { gte: period.periodStart } },
          ],
        },
        include: {
          salaryComponents: true,
          position: { select: { attendanceRatePerDay: true } },
          workShift: { select: { workDays: true } },
        },
      }),
      prisma.payrollManualEntry.findMany({ where: { payrollPeriodId } }),
      prisma.bpjsSettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } }),
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

  // Rekonsiliasi akhir tahun/resign (PP 58/2023 & Pasal 17) butuh data
  // Payslip.taxableMonthly/pph21 bulan Januari s/d SEBELUM periode ini, TAHUN
  // YANG SAMA — di-batch-fetch sekali buat semua pegawai (bukan per pegawai)
  // biar tidak N+1 query. Kosong itu VALID (bukan error) — mis. pegawai baru
  // pakai sistem ini pertengahan tahun, cuma bikin rekonsiliasinya kurang
  // akurat (dikasih warning ke admin di bawah), bukan gagal total.
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
  const terRatesByCategory = new Map<string, PayrollTerRateDef[]>()
  for (const r of terRateRows) {
    const list = terRatesByCategory.get(r.category) ?? []
    list.push({ minIncome: r.minIncome, maxIncome: r.maxIncome, ratePercent: r.ratePercent })
    terRatesByCategory.set(r.category, list)
  }
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

  // Dipakai buat nentuin perlu-tidaknya query attendance-allowance (mahal,
  // per pegawai) — true kalau ADA komponen KEHADIRAN jenis apa pun aktif,
  // Pendapatan (Tunjangan Kehadiran) MAUPUN Potongan (Pot.
  // Kehadiran/Punishment, lihat lib/payroll/calculate.ts).
  const hasAttendanceEarningComponent = componentDefs.some(
    (c) =>
      c.calculationType === "KEHADIRAN" &&
      (c.category === "PENDAPATAN_TETAP" || c.category === "PENDAPATAN_TIDAK_TETAP")
  )
  const hasAttendanceComponent =
    hasAttendanceEarningComponent ||
    componentDefs.some((c) => c.calculationType === "KEHADIRAN" && c.category === "POTONGAN")

  const warnings: string[] = []

  const payslipData = await Promise.all(
    employees.map(async (employee) => {
      const golonganRate = resolveGolonganRate(employee.salaryGradeId, employee.salaryGradeStep)

      const ptkpAnnualAmount = ptkpMap.get(employee.ptkpStatus ?? "TK0") ?? 0
      if (!employee.ptkpStatus) {
        warnings.push(`${employee.fullName}: status PTKP belum diisi, dianggap TK/0.`)
      }
      const terCategory = TER_CATEGORY_BY_PTKP_STATUS[employee.ptkpStatus ?? "TK0"]
      const terRates = terRatesByCategory.get(terCategory) ?? []
      if (bpjsSettings.pph21Method === "TER" && terRates.length === 0) {
        warnings.push(
          `${employee.fullName}: tabel Tarif TER Kategori ${terCategory} belum diisi, PPh 21 (TER) dianggap Rp0.`
        )
      }

      // Masa pajak TERAKHIR (PP 58/2023 & Pasal 17) — Desember, ATAU periode
      // yang mengandung tanggal resign pegawai ini (lihat Employee.resignDate).
      const isFinalTaxPeriod =
        period.month === 12 ||
        (employee.resignDate !== null &&
          employee.resignDate >= period.periodStart &&
          employee.resignDate <= period.periodEnd)
      const priorTaxData = priorTaxDataByEmployee.get(employee.id) ?? { taxableSum: 0, pph21Sum: 0, monthsCovered: 0 }
      if (isFinalTaxPeriod && bpjsSettings.pph21Method === "TER") {
        const expectedPriorMonths = period.month - 1
        if (priorTaxData.monthsCovered < expectedPriorMonths) {
          warnings.push(
            `${employee.fullName}: rekonsiliasi akhir tahun cuma menemukan data payslip ${priorTaxData.monthsCovered} dari ${expectedPriorMonths} bulan sebelumnya di sistem tahun ${period.year} — hasil PPh 21 Rekonsiliasi bisa kurang akurat kalau ada bulan yang belum pernah digenerate.`
          )
        }
      }

      if (hasAttendanceComponent && employee.position.attendanceRatePerDay !== null) {
        if (!employee.workShift) {
          warnings.push(
            `${employee.fullName}: belum punya Jam Kerja, hari kerja dianggap Senin-Jumat (default) buat hitung Tunjangan/Pot. Kehadiran.`
          )
        }
        if (!employee.pinAttendance) {
          warnings.push(
            `${employee.fullName}: belum ada PIN mesin absensi, semua hari kerja tanpa izin dianggap mangkir.`
          )
        }
      }

      const attendanceAllowance = hasAttendanceComponent
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

      if (result.gajiPokokSource === "kosong") {
        warnings.push(`${employee.fullName}: Gaji Pokok tidak ditemukan (golongan/step kosong & belum ada nilai manual).`)
      }

      return { employeeId: employee.id, result, isFinalTaxPeriod }
    })
  )

  await prisma.$transaction(async (tx) => {
    await tx.payslip.deleteMany({ where: { payrollPeriodId } })
    for (const { employeeId, result, isFinalTaxPeriod } of payslipData) {
      await tx.payslip.create({
        data: {
          payrollPeriodId,
          employeeId,
          grossPay: result.grossPay,
          totalDeduction: result.totalDeduction,
          pph21: result.pph21,
          netPay: result.netPay,
          taxableMonthly: result.taxableMonthly,
          isFinalTaxPeriod,
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

function cellText(raw: unknown): string {
  if (raw === null || raw === undefined) return ""
  if (typeof raw === "object" && "text" in raw) return String((raw as { text: unknown }).text ?? "").trim()
  return String(raw).trim()
}

function parseAmount(raw: unknown): number {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : 0
  const text = cellText(raw).replace(/[^0-9.,-]/g, "").replace(/,/g, "")
  const parsed = Number(text)
  return Number.isFinite(parsed) ? parsed : 0
}

// Import manual — alternatif Generate/Refresh Payslip (lib/payroll/calculate.ts
// SAMA SEKALI TIDAK dipakai di sini) buat periode yang perhitungan
// otomatisnya belum jadi acuan tetap manajemen. HR unduh template
// (app/api/payroll/proses/[id]/template/route.ts, isi NIP/Nama/Jabatan
// pre-filled + satu kolom per SalaryComponent aktif + kolom PPh 21), isi
// nominal manual, upload di sini.
//
// ALL-OR-NOTHING — beda dari pola import Excel lain di app ini (pegawai/hari
// libur, yang skip baris invalid & tetap proses sisanya): kalau ADA satu
// saja masalah (kolom komponen hilang, NIP tidak dikenal, pegawai eligible
// tidak punya baris, dst.), SELURUH import ditolak, TIDAK ADA yang
// tersimpan — payroll adalah data yang tidak boleh "sebagian ke-generate
// sebagian tidak" tanpa disadari.
export async function importPayslipsAction(
  payrollPeriodId: number,
  _prevState: GeneratePayslipsState,
  formData: FormData
): Promise<GeneratePayslipsState> {
  const period = await prisma.payrollPeriod.findUnique({ where: { id: payrollPeriodId } })
  if (!period) {
    return { success: false, error: "Periode tidak ditemukan." }
  }
  if (period.status === "LOCKED") {
    return { success: false, error: "Periode sudah dikunci, tidak bisa diimpor ulang." }
  }
  if (period.status === "PENDING_APPROVAL") {
    return { success: false, error: "Periode sedang menunggu approval, tidak bisa diimpor ulang." }
  }

  const file = formData.get("file")
  if (!(file instanceof File) || file.size === 0) {
    return { success: false, error: "Pilih file Excel terlebih dahulu." }
  }

  const workbook = new ExcelJS.Workbook()
  try {
    await workbook.xlsx.load(await file.arrayBuffer())
  } catch {
    return { success: false, error: "File tidak bisa dibaca. Pastikan formatnya .xlsx sesuai template." }
  }
  const sheet = workbook.worksheets[0]
  if (!sheet) {
    return { success: false, error: "File Excel tidak memiliki sheet data." }
  }

  // Pegawai eligible & komponen aktif — query SAMA PERSIS dengan
  // generatePayslipsAction, supaya validasi "siapa yang wajib ada barisnya"
  // konsisten dengan template yang diunduh.
  const [employees, components] = await Promise.all([
    prisma.employee.findMany({
      where: {
        OR: [{ isActive: true, isDeleted: false }, { resignDate: { gte: period.periodStart } }],
      },
      select: { id: true, employeeNumber: true, fullName: true, resignDate: true },
    }),
    prisma.salaryComponent.findMany({ where: { isActive: true } }),
  ])
  const employeeByNip = new Map(employees.map((e) => [e.employeeNumber.trim().toLowerCase(), e]))
  const baseSalaryComponent = components.find((c) => c.isBaseSalary) ?? null
  const taxableComponentIds = new Set(components.filter((c) => c.isTaxable).map((c) => c.id))

  // Header row → mapping nama komponen (lowercase) -> nomor kolom. BY NAME,
  // bukan posisi tetap — lihat catatan di lib/reports/payroll-import-template.ts.
  const headerRow = sheet.getRow(1)
  const componentColByName = new Map<string, number>()
  let pph21Col: number | null = null
  for (let col = 4; col <= headerRow.cellCount; col++) {
    const text = cellText(headerRow.getCell(col).value).toLowerCase()
    if (!text) continue
    if (text === "pph 21") pph21Col = col
    else componentColByName.set(text, col)
  }

  const errors: string[] = []
  for (const component of components) {
    if (!componentColByName.has(component.name.trim().toLowerCase())) {
      errors.push(`Kolom komponen "${component.name}" tidak ditemukan di file. Unduh ulang template.`)
    }
  }
  if (pph21Col === null) {
    errors.push(`Kolom "PPh 21" tidak ditemukan di file. Unduh ulang template.`)
  }
  if (errors.length > 0) {
    return { success: false, error: errors.join(" ") }
  }
  // Non-null aman di sini — kalau pph21Col null, sudah return lewat
  // pengecekan errors.length di atas.
  const resolvedPph21Col = pph21Col as number

  type ParsedRow = {
    employeeId: number
    resignDate: Date | null
    pph21: number
    items: { salaryComponentId: number; name: string; category: SalaryComponentCategory; amount: number }[]
  }
  const parsedRows: ParsedRow[] = []
  const seenNip = new Set<string>()

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return
    const nipRaw = cellText(row.getCell(1).value)
    if (!nipRaw) return // baris kosong
    const nipKey = nipRaw.toLowerCase()
    const employee = employeeByNip.get(nipKey)
    if (!employee) {
      errors.push(`Baris ${rowNumber}: NIP "${nipRaw}" tidak dikenali (bukan pegawai eligible periode ini).`)
      return
    }
    if (seenNip.has(nipKey)) {
      errors.push(`Baris ${rowNumber}: NIP "${nipRaw}" duplikat di file ini.`)
      return
    }
    seenNip.add(nipKey)

    const items: ParsedRow["items"] = []
    // Gaji Pokok SELALU items[0] — app/admin/payroll/proses/[id]/page.tsx
    // menurunkan tampilan gajiPokok dari items[0].amount.
    if (baseSalaryComponent) {
      const col = componentColByName.get(baseSalaryComponent.name.trim().toLowerCase())!
      items.push({
        salaryComponentId: baseSalaryComponent.id,
        name: baseSalaryComponent.name,
        category: baseSalaryComponent.category,
        amount: parseAmount(row.getCell(col).value),
      })
    }
    for (const component of components) {
      if (component.isBaseSalary) continue
      const col = componentColByName.get(component.name.trim().toLowerCase())!
      items.push({
        salaryComponentId: component.id,
        name: component.name,
        category: component.category,
        amount: parseAmount(row.getCell(col).value),
      })
    }

    parsedRows.push({
      employeeId: employee.id,
      resignDate: employee.resignDate,
      pph21: parseAmount(row.getCell(resolvedPph21Col).value),
      items,
    })
  })

  const seenEmployeeIds = new Set(parsedRows.map((r) => r.employeeId))
  for (const employee of employees) {
    if (!seenEmployeeIds.has(employee.id)) {
      errors.push(`Pegawai "${employee.fullName}" (NIP ${employee.employeeNumber}) tidak ada barisnya di file.`)
    }
  }

  if (errors.length > 0) {
    const shown = errors.slice(0, 10)
    return {
      success: false,
      error: `${errors.length} masalah ditemukan, tidak ada yang disimpan: ${shown.join(" ")}${
        errors.length > shown.length ? ` ...dan ${errors.length - shown.length} lainnya.` : ""
      }`,
    }
  }

  const payslipData = parsedRows.map((r) => {
    const grossPay = r.items
      .filter((i) => i.category === "PENDAPATAN_TETAP" || i.category === "PENDAPATAN_TIDAK_TETAP")
      .reduce((sum, i) => sum + i.amount, 0)
    const deductionFromItems = r.items
      .filter((i) => i.category === "POTONGAN" || i.category === "PINJAMAN")
      .reduce((sum, i) => sum + i.amount, 0)
    const totalDeduction = deductionFromItems + r.pph21
    const netPay = grossPay - totalDeduction
    const taxableMonthly = r.items
      .filter((i) => taxableComponentIds.has(i.salaryComponentId))
      .reduce((sum, i) => sum + i.amount, 0)
    // Rumus SAMA PERSIS dengan generatePayslipsAction — masa pajak terakhir
    // (Desember, atau periode berisi tanggal resign pegawai).
    const isFinalTaxPeriod =
      period.month === 12 ||
      (r.resignDate !== null && r.resignDate >= period.periodStart && r.resignDate <= period.periodEnd)

    return {
      employeeId: r.employeeId,
      grossPay,
      totalDeduction,
      pph21: r.pph21,
      netPay,
      taxableMonthly,
      isFinalTaxPeriod,
      items: [
        ...r.items,
        { salaryComponentId: null, name: "PPh 21", detail: null, category: "POTONGAN" as const, amount: r.pph21 },
      ],
    }
  })

  await prisma.$transaction(async (tx) => {
    await tx.payslip.deleteMany({ where: { payrollPeriodId } })
    for (const p of payslipData) {
      await tx.payslip.create({
        data: {
          payrollPeriodId,
          employeeId: p.employeeId,
          grossPay: p.grossPay,
          totalDeduction: p.totalDeduction,
          pph21: p.pph21,
          netPay: p.netPay,
          taxableMonthly: p.taxableMonthly,
          isFinalTaxPeriod: p.isFinalTaxPeriod,
          items: {
            create: p.items.map((item) => ({
              salaryComponentId: item.salaryComponentId,
              name: item.name,
              detail: "detail" in item ? item.detail : null,
              category: item.category,
              amount: item.amount,
            })),
          },
        },
      })
    }
  })

  await logPeriod(
    "UPDATE",
    `${period.month}/${period.year} (import manual ${payslipData.length} payslip — BUKAN hasil generate otomatis)`
  )
  revalidatePath(LIST_PATH)
  revalidatePath(detailPath(payrollPeriodId))

  return { success: true, generated: payslipData.length, warnings: [] }
}
