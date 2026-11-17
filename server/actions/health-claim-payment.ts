"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity-log"
import { createNotification } from "@/lib/notifications"
import { getEmployeeUserId, isHealthClaimStaff } from "@/lib/health-claim"
import { deleteClaimFile, validateClaimFile, writeClaimFile } from "@/lib/health-claim-storage"
import { formatRupiah } from "@/lib/health-claim-labels"

// Pencatatan pembayaran klaim oleh Accounting — docs/prd-klaim-kesehatan.md 5.5.

export type PaymentActionResult = { error: string } | { success: string }

type Actor = {
  userId: number
  username: string
  employeeId: number | null
  role: string
  name: string
}

async function currentActor(): Promise<Actor | null> {
  const session = await auth()
  const user = session?.user
  if (!user) return null
  const employee = user.employeeId
    ? await prisma.employee.findUnique({
        where: { id: user.employeeId },
        select: { fullName: true },
      })
    : null
  return {
    userId: Number(user.id),
    username: user.username,
    employeeId: user.employeeId ?? null,
    role: user.role,
    name: employee?.fullName ?? user.username,
  }
}

async function requireAccounting() {
  const actor = await currentActor()
  if (!actor) return null
  if (actor.role === "SUPER_ADMIN" || (await isHealthClaimStaff(actor.employeeId, "ACCOUNTING"))) return actor
  return null
}

const NO_ACCESS = {
  error: "Hanya Accounting yang ditunjuk yang bisa mencatat pembayaran klaim.",
}

function revalidatePayment(memoPublicId: string) {
  for (const p of [
    "/pegawai/pembayaran-klaim",
    `/pegawai/pembayaran-klaim/${memoPublicId}`,
    "/pegawai/pemeriksaan-klaim/nota-dinas",
    `/pegawai/pemeriksaan-klaim/nota-dinas/${memoPublicId}`,
    "/admin/payroll/klaim-kesehatan/nota-dinas",
    `/admin/payroll/klaim-kesehatan/nota-dinas/${memoPublicId}`,
    "/admin/payroll/klaim-kesehatan",
    "/admin/payroll/klaim-kesehatan/rekap",
    "/pegawai/klaim-kesehatan",
  ]) {
    revalidatePath(p)
  }
}

async function notifyEmployee(employeeId: number, title: string, message: string, link: string) {
  const userId = await getEmployeeUserId(employeeId)
  if (userId) await createNotification({ userId, title, message, link })
}

// Klaim selalu dibayar lewat TRANSFER ke rekening pegawai, dan setiap
// pembayaran wajib mencatat Nomor Jurnal di CBS (disimpan di kolom reference).
const entrySchema = z.object({
  claimPublicId: z.string().min(1),
  paidDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal transfer tidak valid"),
  journalNumber: z
    .string()
    .trim()
    .min(1, "Nomor Jurnal CBS wajib diisi")
    .max(150, "Nomor Jurnal CBS maksimal 150 karakter"),
  bankName: z.string().trim().min(1, "Nama bank wajib diisi").max(100),
  bankAccountNumber: z
    .string()
    .trim()
    .max(50)
    .refine((v) => v.replace(/\D/g, "").length > 0, "Nomor rekening wajib diisi"),
  bankAccountHolder: z.string().trim().max(150).optional(),
  saveToEmployee: z.boolean().optional(),
})

export async function recordPaymentsAction(
  memoPublicId: string,
  entries: z.input<typeof entrySchema>[],
): Promise<PaymentActionResult> {
  const actor = await requireAccounting()
  if (!actor) return NO_ACCESS
  const parsed = z.array(entrySchema).min(1, "Pilih minimal satu klaim untuk dicatat").safeParse(entries)
  if (!parsed.success)
    return {
      error: parsed.error.issues[0]?.message ?? "Data pembayaran tidak valid.",
    }

  const memo = await prisma.healthClaimMemo.findUnique({
    where: { publicId: memoPublicId },
    include: {
      items: {
        include: {
          claim: {
            select: {
              id: true,
              publicId: true,
              claimNumber: true,
              status: true,
              employeeId: true,
              payment: { select: { id: true } },
            },
          },
        },
      },
    },
  })
  if (!memo) return { error: "Nota Dinas tidak ditemukan." }
  if (memo.status !== "DISETUJUI")
    return {
      error: "Hanya Nota Dinas yang sudah disetujui dan belum lunas yang bisa dicatat pembayarannya.",
    }

  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Jakarta",
  })
  const byClaim = new Map(memo.items.map((i) => [i.claim.publicId, i]))
  for (const e of parsed.data) {
    const item = byClaim.get(e.claimPublicId)
    if (!item)
      return {
        error: "Sebagian klaim tidak ada di Nota Dinas ini. Muat ulang halaman.",
      }
    if (item.claim.payment || item.claim.status !== "DISETUJUI") {
      return {
        error: `Klaim ${item.claim.claimNumber} sudah tercatat dibayar.`,
      }
    }
    if (e.paidDate > today) return { error: "Tanggal transfer tidak boleh di masa depan." }
  }

  let allPaid = false
  try {
    await prisma.$transaction(async (tx) => {
      for (const e of parsed.data) {
        const item = byClaim.get(e.claimPublicId)!
        const accountNumber = e.bankAccountNumber.replace(/\D/g, "")
        await tx.healthClaimPayment.create({
          data: {
            claimId: item.claim.id,
            memoId: memo.id,
            method: "TRANSFER",
            paidDate: new Date(`${e.paidDate}T00:00:00Z`),
            amount: item.amount,
            reference: e.journalNumber,
            bankName: e.bankName,
            bankAccountNumber: accountNumber,
            bankAccountHolder: e.bankAccountHolder || null,
            recordedByName: actor.name,
          },
        })
        const moved = await tx.healthClaim.updateMany({
          where: { id: item.claim.id, status: "DISETUJUI" },
          data: { status: "DIBAYAR" },
        })
        if (moved.count === 0) throw new Error("STATUS_BERUBAH")
        await tx.healthClaimEvent.create({
          data: {
            claimId: item.claim.id,
            action: "DIBAYAR",
            actorName: actor.name,
            note: `Ditransfer ${formatRupiah(item.amount)} ke ${e.bankName} ${accountNumber} (jurnal CBS ${e.journalNumber}).`,
          },
        })
        if (e.saveToEmployee) {
          await tx.employee.update({
            where: { id: item.claim.employeeId },
            data: {
              bankName: e.bankName,
              bankAccountNumber: accountNumber,
              bankAccountHolder: e.bankAccountHolder || null,
            },
          })
        }
      }
      const unpaid = await tx.healthClaimMemoItem.count({
        where: { memoId: memo.id, claim: { payment: null } },
      })
      allPaid = unpaid === 0
      if (allPaid)
        await tx.healthClaimMemo.update({
          where: { id: memo.id },
          data: { status: "DIBAYAR" },
        })
    })
  } catch (err) {
    if (err instanceof Error && err.message === "STATUS_BERUBAH")
      return { error: "Sebagian klaim sudah dicatat. Muat ulang halaman." }
    throw err
  }

  const total = parsed.data.reduce((s, e) => s + byClaim.get(e.claimPublicId)!.amount, 0)
  for (const e of parsed.data) {
    const item = byClaim.get(e.claimPublicId)!
    await notifyEmployee(
      item.claim.employeeId,
      "Klaim kesehatan sudah dibayar",
      `Klaim ${item.claim.claimNumber} sebesar ${formatRupiah(item.amount)} sudah ditransfer ke rekening ${e.bankName} ${e.bankAccountNumber.replace(/\D/g, "")}.`,
      `/pegawai/klaim-kesehatan/${item.claim.publicId}`,
    )
  }
  if (allPaid) {
    await notifyEmployee(
      memo.createdByEmployeeId,
      "Nota Dinas lunas",
      `Semua klaim di Nota Dinas ${memo.memoNumber} sudah dibayar.`,
      `/pegawai/pemeriksaan-klaim/nota-dinas/${memo.publicId}`,
    )
  }
  await logActivity({
    userId: actor.userId,
    username: actor.username,
    action: "UPDATE",
    entityType: "HealthClaimPayment",
    description: `${actor.username} mencatat pembayaran ${parsed.data.length} klaim di Nota Dinas ${memo.memoNumber} sebesar ${formatRupiah(total)}${allPaid ? " (lunas)" : ""}.`,
  })
  revalidatePayment(memo.publicId)
  return {
    success: allPaid
      ? `Pembayaran tercatat. Nota Dinas ${memo.memoNumber} lunas.`
      : `Pembayaran ${parsed.data.length} klaim tercatat (${formatRupiah(total)}).`,
  }
}

// Koreksi pembayaran yang salah catat — hanya Super Admin, wajib alasan.
export async function cancelPaymentAction(claimPublicId: string, reason: string): Promise<PaymentActionResult> {
  const actor = await currentActor()
  if (actor?.role !== "SUPER_ADMIN") return { error: "Hanya Super Admin yang bisa membatalkan pembayaran." }
  const note = reason.trim()
  if (note.length < 5) return { error: "Tulis alasan pembatalan minimal 5 karakter." }

  const claim = await prisma.healthClaim.findUnique({
    where: { publicId: claimPublicId },
    select: {
      id: true,
      claimNumber: true,
      employeeId: true,
      payment: {
        select: {
          id: true,
          memoId: true,
          amount: true,
          memo: { select: { publicId: true, memoNumber: true } },
        },
      },
    },
  })
  if (!claim?.payment) return { error: "Klaim ini belum tercatat dibayar." }
  const payment = claim.payment

  await prisma.$transaction(async (tx) => {
    await tx.healthClaimPayment.delete({ where: { id: payment.id } })
    await tx.healthClaim.update({
      where: { id: claim.id },
      data: { status: "DISETUJUI" },
    })
    await tx.healthClaimMemo.updateMany({
      where: { id: payment.memoId, status: "DIBAYAR" },
      data: { status: "DISETUJUI" },
    })
    await tx.healthClaimEvent.create({
      data: {
        claimId: claim.id,
        action: "PEMBAYARAN_DIBATALKAN",
        actorName: actor.name,
        note,
      },
    })
  })
  await logActivity({
    userId: actor.userId,
    username: actor.username,
    action: "UPDATE",
    entityType: "HealthClaimPayment",
    description: `${actor.username} membatalkan catatan pembayaran klaim ${claim.claimNumber} (${formatRupiah(payment.amount)}): ${note}`,
  })
  revalidatePayment(payment.memo.publicId)
  return {
    success: `Catatan pembayaran klaim ${claim.claimNumber} dibatalkan.`,
  }
}

export async function uploadPaymentProofAction(memoPublicId: string, formData: FormData): Promise<PaymentActionResult> {
  const actor = await requireAccounting()
  if (!actor) return NO_ACCESS
  const memo = await prisma.healthClaimMemo.findUnique({
    where: { publicId: memoPublicId },
    select: { id: true, memoNumber: true, status: true },
  })
  if (!memo) return { error: "Nota Dinas tidak ditemukan." }
  if (memo.status !== "DISETUJUI" && memo.status !== "DIBAYAR")
    return { error: "Bukti hanya untuk Nota Dinas yang sudah disetujui." }

  const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0)
  if (files.length === 0) return { error: "Pilih file bukti terlebih dahulu." }
  if (files.length > 5) return { error: "Maksimal 5 file sekali unggah." }
  const validated = []
  for (const f of files) {
    const v = await validateClaimFile(f)
    if ("error" in v) return { error: v.error }
    validated.push(v)
  }
  const stored: string[] = []
  try {
    for (const v of validated) stored.push(await writeClaimFile(v))
    await prisma.healthClaimPaymentProof.createMany({
      data: validated.map((v, i) => ({
        memoId: memo.id,
        storedFileName: stored[i],
        originalName: v.originalName,
        sizeBytes: v.buffer.length,
        uploadedByName: actor.name,
      })),
    })
  } catch (err) {
    await Promise.all(stored.map((s) => deleteClaimFile(s)))
    console.error("Gagal menyimpan bukti pembayaran:", err)
    return { error: "Bukti gagal disimpan. Coba lagi." }
  }
  await logActivity({
    userId: actor.userId,
    username: actor.username,
    action: "CREATE",
    entityType: "HealthClaimPayment",
    description: `${actor.username} mengunggah ${validated.length} bukti pembayaran untuk Nota Dinas ${memo.memoNumber}.`,
  })
  revalidatePayment(memoPublicId)
  return { success: `${validated.length} bukti pembayaran diunggah.` }
}

export async function deletePaymentProofAction(proofPublicId: string): Promise<PaymentActionResult> {
  const actor = await requireAccounting()
  if (!actor) return NO_ACCESS
  const proof = await prisma.healthClaimPaymentProof.findUnique({
    where: { publicId: proofPublicId },
    select: {
      id: true,
      storedFileName: true,
      originalName: true,
      memo: { select: { publicId: true, memoNumber: true } },
    },
  })
  if (!proof) return { error: "Bukti tidak ditemukan." }
  await prisma.healthClaimPaymentProof.delete({ where: { id: proof.id } })
  await deleteClaimFile(proof.storedFileName)
  await logActivity({
    userId: actor.userId,
    username: actor.username,
    action: "DELETE",
    entityType: "HealthClaimPayment",
    description: `${actor.username} menghapus bukti pembayaran "${proof.originalName}" dari Nota Dinas ${proof.memo.memoNumber}.`,
  })
  revalidatePayment(proof.memo.publicId)
  return { success: "Bukti pembayaran dihapus." }
}
