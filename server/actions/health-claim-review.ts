"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity-log"
import { createNotification, createNotificationForUsers } from "@/lib/notifications"
import {
  canReviewHealthClaims,
  getClaimEligibility,
  getEmployeeUserId,
  getHealthClaimSettings,
  getMemoQueueStats,
  getRemainingForConfirmation,
  getStaffUserIds,
} from "@/lib/health-claim"
import { formatRupiah } from "@/lib/health-claim-labels"

// Konfirmasi klaim oleh petugas — docs/prd-klaim-kesehatan.md 5.2.

export type ReviewResult = { error: string } | { success: string }

async function reviewer() {
  const session = await auth()
  const user = session?.user
  if (!user || !(await canReviewHealthClaims(user))) return null
  const employee = user.employeeId
    ? await prisma.employee.findUnique({ where: { id: user.employeeId }, select: { fullName: true } })
    : null
  return { ...user, displayName: employee?.fullName ?? user.username }
}

const NO_ACCESS: ReviewResult = { error: "Hanya petugas klaim yang ditunjuk yang bisa memproses klaim." }

function revalidateClaim(publicId: string) {
  revalidatePath("/admin/payroll/klaim-kesehatan")
  revalidatePath(`/admin/payroll/klaim-kesehatan/${publicId}`)
  revalidatePath("/pegawai/pemeriksaan-klaim")
  revalidatePath(`/pegawai/pemeriksaan-klaim/${publicId}`)
  revalidatePath("/pegawai/klaim-kesehatan")
  revalidatePath(`/pegawai/klaim-kesehatan/${publicId}`)
}

async function loadClaim(publicId: string) {
  return prisma.healthClaim.findUnique({
    where: { publicId },
    select: {
      id: true,
      publicId: true,
      claimNumber: true,
      status: true,
      employeeId: true,
      plafonYear: true,
      submittedAt: true,
      bpjsCovered: true,
      requestedAmount: true,
      items: { select: { id: true, amount: true, description: true } },
      employee: { select: { fullName: true } },
    },
  })
}

const confirmSchema = z.object({
  items: z.array(
    z.object({
      id: z.number().int(),
      approvedAmount: z.number().int().min(0, "Nominal disetujui tidak boleh negatif"),
      note: z.string().trim().max(500, "Catatan maksimal 500 karakter").optional(),
    })
  ),
  note: z.string().trim().max(1000, "Catatan maksimal 1000 karakter").optional(),
})

export async function confirmHealthClaimAction(
  publicId: string,
  input: { items: { id: number; approvedAmount: number; note?: string }[]; note?: string }
): Promise<ReviewResult> {
  const user = await reviewer()
  if (!user) return NO_ACCESS
  const parsed = confirmSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Data tidak valid." }

  const claim = await loadClaim(publicId)
  if (!claim) return { error: "Klaim tidak ditemukan." }
  if (claim.status !== "MENUNGGU_KONFIRMASI") return { error: "Klaim ini tidak sedang menunggu konfirmasi." }
  if (claim.employeeId === user.employeeId) return { error: "Anda tidak bisa mengonfirmasi klaim milik sendiri." }

  // Setiap baris rincian harus ada keputusannya; penyesuaian wajib beralasan.
  const byId = new Map(parsed.data.items.map((i) => [i.id, i]))
  for (const item of claim.items) {
    const decision = byId.get(item.id)
    if (!decision) return { error: "Rincian biaya berubah. Muat ulang halaman." }
    if (decision.approvedAmount > item.amount) {
      return { error: `Nominal disetujui untuk "${item.description}" tidak boleh melebihi nominal diajukan.` }
    }
    if (decision.approvedAmount !== item.amount && !decision.note) {
      return { error: `Tulis alasan penyesuaian untuk "${item.description}".` }
    }
  }

  const eligibility = await getClaimEligibility(claim.employeeId)
  const plafon = eligibility.plafon ?? 0
  const adjustedTotal = claim.items.reduce((s, i) => s + byId.get(i.id)!.approvedAmount, 0)
  const afterBpjs = Math.max(0, adjustedTotal - claim.bpjsCovered)
  if (afterBpjs === 0) return { error: "Nominal yang disetujui menjadi Rp 0. Gunakan Tolak bila klaim tidak bisa dibayar." }

  const queueBefore = await getMemoQueueStats()

  let approved = 0
  let capped = false
  try {
    await prisma.$transaction(async (tx) => {
      // Sisa plafon dihitung di dalam transaksi, tanpa klaim ini sendiri.
      const remaining = await getRemainingForConfirmation(claim, plafon, tx)
      approved = Math.min(afterBpjs, remaining)
      capped = approved < afterBpjs
      if (approved <= 0) throw new Error("PLAFON_HABIS")

      const updated = await tx.healthClaim.updateMany({
        where: { id: claim.id, status: "MENUNGGU_KONFIRMASI" },
        data: { status: "TERKONFIRMASI", approvedAmount: approved },
      })
      if (updated.count === 0) throw new Error("STATUS_BERUBAH")
      for (const item of claim.items) {
        const d = byId.get(item.id)!
        await tx.healthClaimItem.update({
          where: { id: item.id },
          data: { approvedAmount: d.approvedAmount, adjustmentNote: d.approvedAmount !== item.amount ? d.note : null },
        })
      }
      const notes = [
        parsed.data.note,
        afterBpjs !== claim.requestedAmount ? `Nominal disesuaikan dari ${formatRupiah(claim.requestedAmount)}.` : null,
        capped ? `Dibatasi sisa plafon menjadi ${formatRupiah(approved)}.` : null,
      ].filter(Boolean)
      await tx.healthClaimEvent.create({
        data: {
          claimId: claim.id,
          action: "DIKONFIRMASI",
          actorName: user.displayName,
          note: `Disetujui ${formatRupiah(approved)}.${notes.length ? ` ${notes.join(" ")}` : ""}`,
        },
      })
    })
  } catch (err) {
    if (err instanceof Error && err.message === "PLAFON_HABIS") {
      return { error: "Plafon pegawai ini untuk tahun tersebut sudah habis. Gunakan Tolak dengan alasan plafon habis." }
    }
    if (err instanceof Error && err.message === "STATUS_BERUBAH") {
      return { error: "Klaim sudah diproses petugas lain. Muat ulang halaman." }
    }
    throw err
  }

  await logActivity({
    userId: Number(user.id),
    username: user.username,
    action: "UPDATE",
    entityType: "HealthClaim",
    description: `${user.username} mengonfirmasi klaim kesehatan ${claim.claimNumber} milik "${claim.employee.fullName}" sebesar ${formatRupiah(approved)}${capped ? " (dibatasi sisa plafon)" : ""}.`,
  })
  const ownerUserId = await getEmployeeUserId(claim.employeeId)
  if (ownerUserId) {
    await createNotification({
      userId: ownerUserId,
      title: "Klaim kesehatan dikonfirmasi",
      message: `Klaim ${claim.claimNumber} disetujui petugas sebesar ${formatRupiah(approved)}${
        capped ? " (dibatasi sisa plafon)" : ""
      } dan menunggu diajukan dalam Nota Dinas.`,
      link: `/pegawai/klaim-kesehatan/${claim.publicId}`,
    })
  }

  // Beri tahu petugas sekali saat antrean pertama kali memenuhi syarat Nota Dinas.
  const { minEmployeesPerMemo } = await getHealthClaimSettings()
  const queueAfter = await getMemoQueueStats()
  if (queueBefore.claims < minEmployeesPerMemo && queueAfter.claims >= minEmployeesPerMemo) {
    await createNotificationForUsers(await getStaffUserIds("PETUGAS"), {
      title: "Klaim siap dibuatkan Nota Dinas",
      message: `Sudah ada ${queueAfter.claims} klaim terkonfirmasi dari ${queueAfter.employees} pegawai (total ${formatRupiah(queueAfter.amount)}). Nota Dinas sudah bisa dibuat.`,
      link: "/pegawai/pemeriksaan-klaim?status=TERKONFIRMASI",
    })
  }

  revalidateClaim(claim.publicId)
  return {
    success: capped
      ? `Klaim ${claim.claimNumber} dikonfirmasi sebesar ${formatRupiah(approved)} (dibatasi sisa plafon).`
      : `Klaim ${claim.claimNumber} dikonfirmasi sebesar ${formatRupiah(approved)}.`,
  }
}

const noteSchema = z.string().trim().min(5, "Tulis catatan minimal 5 karakter").max(1000, "Catatan maksimal 1000 karakter")

async function decide(
  publicId: string,
  rawNote: string,
  kind: "REVISI" | "DITOLAK"
): Promise<ReviewResult> {
  const user = await reviewer()
  if (!user) return NO_ACCESS
  const note = noteSchema.safeParse(rawNote)
  if (!note.success) return { error: note.error.issues[0]?.message ?? "Catatan tidak valid." }

  const claim = await loadClaim(publicId)
  if (!claim) return { error: "Klaim tidak ditemukan." }
  if (claim.status !== "MENUNGGU_KONFIRMASI") return { error: "Klaim ini tidak sedang menunggu konfirmasi." }
  if (claim.employeeId === user.employeeId) return { error: "Anda tidak bisa memproses klaim milik sendiri." }

  const updated = await prisma.healthClaim.updateMany({
    where: { id: claim.id, status: "MENUNGGU_KONFIRMASI" },
    data: { status: kind },
  })
  if (updated.count === 0) return { error: "Klaim sudah diproses petugas lain. Muat ulang halaman." }
  await prisma.healthClaimEvent.create({
    data: { claimId: claim.id, action: kind, actorName: user.displayName, note: note.data },
  })

  const verb = kind === "REVISI" ? "meminta revisi" : "menolak"
  await logActivity({
    userId: Number(user.id),
    username: user.username,
    action: "UPDATE",
    entityType: "HealthClaim",
    description: `${user.username} ${verb} klaim kesehatan ${claim.claimNumber} milik "${claim.employee.fullName}": ${note.data}`,
  })
  const ownerUserId = await getEmployeeUserId(claim.employeeId)
  if (ownerUserId) {
    await createNotification({
      userId: ownerUserId,
      title: kind === "REVISI" ? "Klaim kesehatan perlu diperbaiki" : "Klaim kesehatan ditolak",
      message:
        kind === "REVISI"
          ? `Petugas meminta perbaikan klaim ${claim.claimNumber}: ${note.data}`
          : `Klaim ${claim.claimNumber} ditolak: ${note.data}`,
      link: `/pegawai/klaim-kesehatan/${claim.publicId}`,
    })
  }

  revalidateClaim(claim.publicId)
  return {
    success: kind === "REVISI" ? `Klaim ${claim.claimNumber} dikembalikan ke pegawai untuk diperbaiki.` : `Klaim ${claim.claimNumber} ditolak.`,
  }
}

export async function requestHealthClaimRevisionAction(publicId: string, note: string) {
  return decide(publicId, note, "REVISI")
}

export async function rejectHealthClaimAction(publicId: string, reason: string) {
  return decide(publicId, reason, "DITOLAK")
}
