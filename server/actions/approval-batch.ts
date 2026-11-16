"use server"

import { revalidatePath } from "next/cache"

import { auth } from "@/auth"
import { logActivity } from "@/lib/activity-log"
import { getApprovalCenterData } from "@/lib/approval-queue"
import { approveOvertimeRequestAction } from "@/server/actions/overtime"
import { approveOfficeExitRequestAction } from "@/server/actions/office-exit"
import { approveEarlyLeaveRequestAction } from "@/server/actions/early-leave"
import { approveLateArrivalRequestAction } from "@/server/actions/late-arrival"
import { approveSickLeaveRequestAction } from "@/server/actions/sick-leave"
import { approveCutiRequestAction } from "@/server/actions/cuti"
import { approveMaternityLeaveRequestAction } from "@/server/actions/maternity-leave"
import { approveSpecialLeaveRequestAction } from "@/server/actions/special-leave"
import { approveDispensationRequestAction } from "@/server/actions/dispensation"
import { approveCutiBesarRequestAction } from "@/server/actions/cuti-besar"
import { approveUnpaidLeaveRequestAction } from "@/server/actions/unpaid-leave"
import { approveOffSiteAttendanceRequestAction } from "@/server/actions/off-site-attendance"
import { approveAttendanceStatementRequestAction } from "@/server/actions/attendance-statement"

// Approve banyak pengajuan sekaligus dari Approval Center. Tiap item tetap
// diproses lewat server action approve MILIK jenis izinnya (yang sama
// persis dengan tombol "Setujui" per baris), jadi semua validasi, alur
// step berikutnya, notifikasi, dan log tetap berjalan seperti biasa.

type ApproveFn = (requestId: number, prev: { error?: string } | undefined, formData: FormData) => Promise<{ error?: string } | undefined>

const APPROVE_BY_KIND: Record<string, ApproveFn> = {
  lembur: approveOvertimeRequestAction,
  meninggalkan_kantor: approveOfficeExitRequestAction,
  pulang_cepat: approveEarlyLeaveRequestAction,
  terlambat: approveLateArrivalRequestAction,
  sakit: approveSickLeaveRequestAction,
  cuti: approveCutiRequestAction,
  cuti_bersalin: approveMaternityLeaveRequestAction,
  cuti_khusus: approveSpecialLeaveRequestAction,
  dispensasi: approveDispensationRequestAction,
  cuti_besar: approveCutiBesarRequestAction,
  cuti_diluar_tanggungan: approveUnpaidLeaveRequestAction,
  absen_luar_kantor: approveOffSiteAttendanceRequestAction,
  tidak_absen: approveAttendanceStatementRequestAction,
}

const CONFIRM_TEXT = "SETUJU"
const MAX_ITEMS = 100

export type BatchApproveItem = { kind: string; id: number }

export type BatchApproveResult = {
  error?: string
  approved?: number
  failed?: { kind: string; id: number; applicant: string; type: string; reason: string }[]
}

export async function batchApproveAction(
  items: BatchApproveItem[],
  confirmText: string,
  catatan: string
): Promise<BatchApproveResult> {
  const session = await auth()
  const employeeId = session?.user.employeeId
  if (!session?.user || !employeeId) {
    return { error: "Akun Anda tidak terhubung ke data pegawai." }
  }
  if (confirmText.trim() !== CONFIRM_TEXT) {
    return { error: `Ketik ${CONFIRM_TEXT} untuk mengonfirmasi.` }
  }
  if (!Array.isArray(items) || items.length === 0) {
    return { error: "Pilih minimal satu pengajuan." }
  }
  if (items.length > MAX_ITEMS) {
    return { error: `Maksimal ${MAX_ITEMS} pengajuan sekali proses.` }
  }

  // Cocokkan dengan antrean MILIK approver ini yang sebenarnya (bukan
  // percaya kiriman client): hanya item yang memang sedang menunggu dia.
  // Payroll & konfirmasi Pegawai Pengganti dikecualikan dari batch — yang
  // pertama wajib ditinjau angkanya, yang kedua pernyataan kesediaan pribadi.
  const { queue } = await getApprovalCenterData(employeeId)
  const queueByKey = new Map(queue.map((row) => [`${row.kind}:${row.id}`, row]))

  const failed: NonNullable<BatchApproveResult["failed"]> = []
  let approved = 0
  const seen = new Set<string>()

  for (const item of items) {
    const key = `${item.kind}:${item.id}`
    if (seen.has(key)) continue
    seen.add(key)

    const row = queueByKey.get(key)
    const approve = APPROVE_BY_KIND[item.kind]
    if (!row || !approve) {
      failed.push({ kind: item.kind, id: item.id, applicant: "-", type: item.kind, reason: "Tidak lagi ada di antrean Anda." })
      continue
    }
    if (row.currentStepType === "PEGAWAI_PENGGANTI") {
      failed.push({ ...item, applicant: row.applicant, type: row.type, reason: "Konfirmasi pengganti harus satu per satu." })
      continue
    }

    const formData = new FormData()
    formData.set("catatan", catatan.trim())
    try {
      const result = await approve(row.id, undefined, formData)
      if (result?.error) {
        failed.push({ ...item, applicant: row.applicant, type: row.type, reason: result.error })
      } else {
        approved++
      }
    } catch (err) {
      failed.push({
        ...item,
        applicant: row.applicant,
        type: row.type,
        reason: err instanceof Error ? err.message : "Gagal diproses.",
      })
    }
  }

  await logActivity({
    userId: Number(session.user.id),
    username: session.user.username,
    action: "UPDATE",
    entityType: "ApprovalBatch",
    description: `${session.user.username} menyetujui ${approved} pengajuan sekaligus (batch)${failed.length > 0 ? `, ${failed.length} gagal` : ""}.`,
  })

  for (const prefix of ["/admin", "/pegawai"]) {
    revalidatePath(`${prefix}/approval-center`)
    revalidatePath(`${prefix}/riwayat-izin`)
  }

  return { approved, failed }
}
