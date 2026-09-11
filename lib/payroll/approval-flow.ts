import type { PayrollApprovalStage } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import { createNotification } from "@/lib/notifications"
import { formatPeriodLabel } from "@/lib/month-names"

// Fungsi di sini dipanggil dari dua konteks: di dalam $transaction maupun di
// luarnya. Client-nya di-extend (lihat lib/prisma.ts) sehingga tipe `tx` dari
// callback $transaction BUKAN Prisma.TransactionClient bawaan — dicocokkan
// dengan membuang method tingkat-client yang memang tidak tersedia di dalam
// transaksi, jadi keduanya sama-sama muat.
type Db = Omit<
  typeof prisma,
  "$extends" | "$transaction" | "$connect" | "$disconnect" | "$on" | "$use"
>

export type PayrollFlowStepConfig = {
  order: number
  approverEmployeeId: number
  approverName: string
}

// Konfigurasi alur (siapa saja penyetujunya, urut) untuk satu tahap —
// dibaca halaman Pengaturan Payroll & dipakai saat pengajuan dibuat.
export async function getPayrollFlowConfig(stage: PayrollApprovalStage): Promise<PayrollFlowStepConfig[]> {
  const steps = await prisma.payrollApprovalFlowStep.findMany({
    where: { stage },
    orderBy: { order: "asc" },
    select: { order: true, approverEmployeeId: true, approverEmployee: { select: { fullName: true } } },
  })
  return steps.map((s) => ({
    order: s.order,
    approverEmployeeId: s.approverEmployeeId,
    approverName: s.approverEmployee.fullName,
  }))
}

// Siklus approval ke berapa yang sedang/terakhir berjalan untuk tahap ini.
// 0 = belum pernah ada sama sekali.
export async function getLatestRound(
  periodId: number,
  stage: PayrollApprovalStage,
  tx: Db = prisma
): Promise<number> {
  const last = await tx.payrollApprovalStep.findFirst({
    where: { payrollPeriodId: periodId, stage },
    orderBy: { round: "desc" },
    select: { round: true },
  })
  return last?.round ?? 0
}

export type StartApprovalResult =
  | { configured: false } // alur belum diatur — pemanggil jatuh ke perilaku lama (cuma SUPER_ADMIN yang memutuskan)
  | { configured: true; firstApproverEmployeeId: number; round: number }

// Salin konfigurasi alur jadi step nyata milik periode ini, sebagai siklus
// (round) BARU. Konfigurasi sengaja DISALIN, bukan dirujuk — mengubah daftar
// penyetuju belakangan tidak boleh mengacak pengajuan yang sedang berjalan
// atau riwayat siklus sebelumnya.
export async function startPayrollApproval(
  tx: Db,
  periodId: number,
  stage: PayrollApprovalStage
): Promise<StartApprovalResult> {
  const config = await tx.payrollApprovalFlowStep.findMany({
    where: { stage },
    orderBy: { order: "asc" },
    select: { order: true, approverEmployeeId: true },
  })
  // Belum diatur sama sekali = jangan blokir payroll. Pemanggil akan memakai
  // perilaku lama (keputusan langsung di tangan SUPER_ADMIN) supaya instalasi
  // yang belum sempat mengkonfigurasi alur tidak mendadak buntu.
  if (config.length === 0) return { configured: false }

  const round = (await getLatestRound(periodId, stage, tx)) + 1
  await tx.payrollApprovalStep.createMany({
    data: config.map((step, index) => ({
      payrollPeriodId: periodId,
      stage,
      round,
      order: step.order,
      approverEmployeeId: step.approverEmployeeId,
      // Step pertama langsung jalan, sisanya antre.
      status: index === 0 ? ("IN_PROGRESS" as const) : ("WAITING" as const),
    })),
  })
  return { configured: true, firstApproverEmployeeId: config[0]!.approverEmployeeId, round }
}

// Step yang sedang menunggu keputusan (maksimal satu per periode, karena
// tahap LOCK & UNLOCK tidak pernah berjalan bersamaan).
export async function getActiveApprovalStep(periodId: number, tx: Db = prisma) {
  return tx.payrollApprovalStep.findFirst({
    where: { payrollPeriodId: periodId, status: "IN_PROGRESS" },
    orderBy: [{ round: "desc" }, { order: "asc" }],
  })
}

// Kabari penyetuju bahwa giliran dia. SENGAJA di modul lib (bukan di file
// "use server") supaya bisa dipakai dua file action sekaligus — export dari
// file "use server" otomatis jadi server action yang bisa dipanggil dari
// browser, dan helper internal seperti ini tidak boleh begitu.
//
// Penyetuju disimpan sebagai Employee sedangkan notifikasi menyasar User —
// pegawai tanpa akun login otomatis terlewat karena tidak ada yang bisa
// dinotifikasi untuknya.
export async function notifyApproverTurn(
  approverEmployeeId: number,
  period: { id: number; month: number; year: number },
  stage: PayrollApprovalStage
) {
  const approver = await prisma.employee.findUnique({
    where: { id: approverEmployeeId },
    select: { user: { select: { id: true } } },
  })
  if (!approver?.user?.id) return
  const label = formatPeriodLabel(period.month, period.year)
  await createNotification({
    userId: approver.user.id,
    title: stage === "LOCK" ? "Persetujuan Payroll Diperlukan" : "Persetujuan Koreksi Payroll Diperlukan",
    message:
      stage === "LOCK"
        ? `Payroll periode ${label} menunggu persetujuan Anda sebelum dikunci.`
        : `Ada permintaan koreksi payroll periode ${label} yang menunggu persetujuan Anda.`,
    link: `/pegawai/persetujuan-payroll/${period.id}`,
  })
}

export type PayrollApprovalHistoryStep = {
  stage: PayrollApprovalStage
  round: number
  order: number
  approverName: string
  status: string
  notes: string | null
  actedAt: Date | null
}

// Seluruh riwayat approval periode ini, siklus terbaru di ATAS — dipakai
// panel riwayat di halaman detail periode.
export async function getPayrollApprovalHistory(periodId: number): Promise<PayrollApprovalHistoryStep[]> {
  const steps = await prisma.payrollApprovalStep.findMany({
    where: { payrollPeriodId: periodId },
    orderBy: [{ round: "desc" }, { stage: "asc" }, { order: "asc" }],
    select: {
      stage: true,
      round: true,
      order: true,
      status: true,
      notes: true,
      actedAt: true,
      approverEmployee: { select: { fullName: true } },
    },
  })
  return steps.map((s) => ({
    stage: s.stage,
    round: s.round,
    order: s.order,
    approverName: s.approverEmployee.fullName,
    status: s.status,
    notes: s.notes,
    actedAt: s.actedAt,
  }))
}
