"use server"

import { revalidatePath } from "next/cache"
import type { PayrollApprovalStage } from "@prisma/client"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity-log"
import { createNotification, createNotificationForUsers } from "@/lib/notifications"
import { formatPeriodLabel } from "@/lib/month-names"
import { getActiveApprovalStep, notifyApproverTurn, startPayrollApproval } from "@/lib/payroll/approval-flow"

export type PayrollApprovalState = { error?: string } | undefined

const LIST_PATH = "/admin/payroll/proses"
const APPROVAL_PATH = "/pegawai/persetujuan-payroll"

function detailPath(id: number) {
  return `${LIST_PATH}/${id}`
}

function revalidateAll(periodId: number) {
  revalidatePath(LIST_PATH)
  revalidatePath(detailPath(periodId))
  revalidatePath(APPROVAL_PATH)
  revalidatePath("/pegawai/approval-center")
  revalidatePath("/admin/approval-center")
}

async function logPayroll(label: string) {
  const session = await auth()
  await logActivity({
    userId: session?.user.id ? Number(session.user.id) : null,
    username: session?.user.username ?? "system",
    action: "UPDATE",
    entityType: "PayrollPeriod",
    description: `${session?.user.username ?? "system"} ${label}`,
  })
}

// Kabari pegawai bahwa slip gajinya sudah bisa dilihat — dipanggil saat
// seluruh tahap approval LOCK lolos. Best-effort, lihat catatan di
// approvePayrollLock() soal kenapa dibungkus try/catch di pemanggilnya.
async function notifyPayslipsPublished(
  period: { id: number; month: number; year: number },
  isCorrection: boolean
) {
  const payslips = await prisma.payslip.findMany({
    where: { payrollPeriodId: period.id },
    select: { employee: { select: { user: { select: { id: true } } } } },
  })
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

async function notifySubmitter(username: string | null, title: string, message: string, periodId: number) {
  if (!username) return
  const user = await prisma.user.findUnique({ where: { username }, select: { id: true } })
  if (!user) return
  await createNotification({ userId: user.id, title, message, link: detailPath(periodId) })
}

// ── Konfigurasi alur (Pengaturan Payroll, SUPER_ADMIN) ───────────────────

// Simpan daftar penyetuju untuk satu tahap. Seluruh step tahap itu ditimpa
// (hapus lalu buat ulang) — urutan & isinya selalu persis seperti yang
// dikirim form, tidak ada sisa baris lama yang menggantung.
//
// Mengubah konfigurasi TIDAK mengganggu pengajuan yang sedang berjalan:
// step per periode sudah disalin saat pengajuan dibuat (lihat
// startPayrollApproval), bukan dirujuk langsung ke tabel ini.
export async function savePayrollApprovalFlowAction(
  stage: PayrollApprovalStage,
  employeeIds: number[]
): Promise<PayrollApprovalState> {
  const session = await auth()
  if (session?.user.role !== "SUPER_ADMIN") {
    return { error: "Cuma Super Admin yang bisa mengatur alur approval payroll." }
  }

  const cleaned = employeeIds.filter((id) => Number.isInteger(id) && id > 0)
  if (new Set(cleaned).size !== cleaned.length) {
    return { error: "Ada penyetuju yang dipilih lebih dari sekali. Tiap tahap harus orang yang berbeda." }
  }
  if (cleaned.length > 0) {
    const found = await prisma.employee.findMany({
      where: { id: { in: cleaned }, isDeleted: false },
      select: { id: true },
    })
    if (found.length !== cleaned.length) {
      return { error: "Ada penyetuju yang datanya sudah tidak valid. Muat ulang halaman lalu pilih ulang." }
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.payrollApprovalFlowStep.deleteMany({ where: { stage } })
    if (cleaned.length > 0) {
      await tx.payrollApprovalFlowStep.createMany({
        data: cleaned.map((approverEmployeeId, index) => ({
          stage,
          order: index + 1,
          approverEmployeeId,
        })),
      })
    }
  })

  await logPayroll(
    `mengubah alur approval payroll tahap ${stage === "LOCK" ? "penguncian" : "koreksi"} (${cleaned.length} penyetuju)`
  )
  revalidatePath("/admin/payroll/pengaturan")
  return undefined
}

// ── Pengajuan oleh HR_ADMIN ──────────────────────────────────────────────

// SENGAJA memeriksa role di sini, bukan menggantungkan diri pada penjaga
// rute di proxy.ts: server action bisa di-POST ke path mana pun, jadi
// penjaga path saja tidak cukup. Sebelumnya aksi ini sama sekali tidak
// memeriksa siapa pemanggilnya — lubang itu ditutup di sini.
async function assertPayrollOfficer() {
  const session = await auth()
  const role = session?.user.role
  if (!session?.user || (role !== "SUPER_ADMIN" && role !== "HR_ADMIN")) {
    return { session: null, error: "Anda tidak berhak mengajukan periode payroll." }
  }
  return { session, error: null }
}

export async function requestPayrollUnlockAction(
  id: number,
  _prevState: PayrollApprovalState,
  formData: FormData
): Promise<PayrollApprovalState> {
  const { session, error } = await assertPayrollOfficer()
  if (!session) return { error: error! }

  const reason = String(formData.get("reason") ?? "").trim()
  if (reason.length < 5) {
    return { error: "Alasan koreksi wajib diisi (minimal 5 karakter)." }
  }

  const period = await prisma.payrollPeriod.findUnique({ where: { id } })
  if (!period) return { error: "Periode tidak ditemukan." }
  if (period.status !== "LOCKED") {
    return { error: "Hanya periode yang sudah terkunci yang bisa diminta koreksi." }
  }

  const started = await prisma.$transaction(async (tx) => {
    const result = await startPayrollApproval(tx, id, "UNLOCK")
    if (!result.configured) return result
    await tx.payrollPeriod.update({
      where: { id },
      data: { status: "PENDING_UNLOCK_APPROVAL", rejectionReason: reason },
    })
    return result
  })

  if (!started.configured) {
    return {
      error:
        "Alur approval koreksi payroll belum diatur. Minta Super Admin mengaturnya di Pengaturan Payroll terlebih dahulu.",
    }
  }

  await logPayroll(
    `mengajukan koreksi payroll "${formatPeriodLabel(period.month, period.year)}" — alasan: ${reason}`
  )
  await notifyApproverTurn(started.firstApproverEmployeeId, period, "UNLOCK")
  revalidateAll(id)
  return undefined
}

// ── Keputusan oleh penyetuju yang ditunjuk ───────────────────────────────

// Menuntaskan satu tahap yang seluruh step-nya sudah disetujui.
async function finalizeStage(
  period: { id: number; month: number; year: number; publishedAt: Date | null },
  stage: PayrollApprovalStage,
  actorUsername: string
) {
  if (stage === "LOCK") {
    const isCorrection = period.publishedAt !== null
    await prisma.payrollPeriod.update({
      where: { id: period.id },
      data: {
        status: "LOCKED",
        lockedAt: new Date(),
        lockedBy: actorUsername,
        rejectionReason: null,
        ...(isCorrection ? {} : { publishedAt: new Date() }),
      },
    })
    // Notifikasi ke SELURUH pegawai tidak boleh menggagalkan penguncian yang
    // sudah tersimpan (tidak ada transaksi yang me-rollback-nya).
    try {
      await notifyPayslipsPublished(period, isCorrection)
    } catch (err) {
      console.error("Gagal mengirim notifikasi slip gaji terbit:", err)
    }
    return
  }

  // UNLOCK disetujui → periode kembali bisa diubah, dan dihitung sebagai
  // satu koreksi (badge "Dikoreksi N×").
  await prisma.payrollPeriod.update({
    where: { id: period.id },
    data: {
      status: "DRAFT",
      lockedAt: null,
      lockedBy: null,
      submittedForApprovalAt: null,
      submittedForApprovalBy: null,
      correctionCount: { increment: 1 },
    },
  })
}

export async function decidePayrollApprovalAction(
  periodId: number,
  decision: "APPROVE" | "REJECT",
  _prevState: PayrollApprovalState,
  formData: FormData
): Promise<PayrollApprovalState> {
  const session = await auth()
  if (!session?.user) return { error: "Sesi tidak valid." }

  const notes = String(formData.get("notes") ?? "").trim()
  if (decision === "REJECT" && notes.length < 5) {
    return { error: "Alasan penolakan wajib diisi (minimal 5 karakter)." }
  }

  const period = await prisma.payrollPeriod.findUnique({ where: { id: periodId } })
  if (!period) return { error: "Periode tidak ditemukan." }

  const step = await getActiveApprovalStep(periodId)
  if (!step) return { error: "Tidak ada tahap approval yang sedang menunggu keputusan." }

  // Penyetuju disimpan sebagai Employee; yang login adalah User. Cocokkan
  // lewat employeeId di sesi — BUKAN lewat role, karena penyetuju payroll
  // bisa saja pegawai biasa yang bukan admin sama sekali.
  if (!session.user.employeeId || session.user.employeeId !== step.approverEmployeeId) {
    return { error: "Anda bukan penyetuju untuk tahap ini." }
  }

  const label = formatPeriodLabel(period.month, period.year)
  const stageLabel = step.stage === "LOCK" ? "penguncian" : "koreksi"

  if (decision === "REJECT") {
    await prisma.$transaction(async (tx) => {
      await tx.payrollApprovalStep.update({
        where: { id: step.id },
        data: { status: "REJECTED", notes, actedAt: new Date() },
      })
      await tx.payrollApprovalStep.updateMany({
        where: { payrollPeriodId: periodId, stage: step.stage, round: step.round, status: "WAITING" },
        data: { status: "SKIPPED", notes: "Dibatalkan — ditolak di tahap sebelumnya." },
      })
      await tx.payrollPeriod.update({
        where: { id: periodId },
        data:
          step.stage === "LOCK"
            ? { status: "DRAFT", submittedForApprovalAt: null, submittedForApprovalBy: null, rejectionReason: notes }
            : // Permintaan koreksi ditolak → periode tetap terkunci & final.
              { status: "LOCKED", rejectionReason: notes },
      })
    })
    await logPayroll(`menolak ${stageLabel} payroll "${label}" — alasan: ${notes}`)
    await notifySubmitter(
      period.submittedForApprovalBy,
      `Approval Payroll Ditolak`,
      `Permintaan ${stageLabel} payroll periode ${label} ditolak: ${notes}`,
      periodId
    )
    revalidateAll(periodId)
    return undefined
  }

  // APPROVE — tuntaskan step ini, lalu majukan giliran atau tutup tahapnya.
  const nextStep = await prisma.$transaction(async (tx) => {
    await tx.payrollApprovalStep.update({
      where: { id: step.id },
      data: { status: "APPROVED", notes: notes || null, actedAt: new Date() },
    })
    const next = await tx.payrollApprovalStep.findFirst({
      where: { payrollPeriodId: periodId, stage: step.stage, round: step.round, status: "WAITING" },
      orderBy: { order: "asc" },
    })
    if (next) {
      await tx.payrollApprovalStep.update({ where: { id: next.id }, data: { status: "IN_PROGRESS" } })
    }
    return next
  })

  if (nextStep) {
    await logPayroll(`menyetujui tahap ${step.order} ${stageLabel} payroll "${label}"`)
    await notifyApproverTurn(nextStep.approverEmployeeId, period, step.stage)
    revalidateAll(periodId)
    return undefined
  }

  await finalizeStage(period, step.stage, session.user.username)
  await logPayroll(`menyetujui ${stageLabel} payroll "${label}" (tahap terakhir)`)
  await notifySubmitter(
    period.submittedForApprovalBy,
    "Approval Payroll Disetujui",
    step.stage === "LOCK"
      ? `Payroll periode ${label} sudah disetujui & dikunci.`
      : `Permintaan koreksi payroll periode ${label} disetujui — periode kembali bisa diubah.`,
    periodId
  )
  revalidateAll(periodId)
  return undefined
}
