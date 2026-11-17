"use server"

import { Prisma } from "@prisma/client"
import { revalidatePath } from "next/cache"
import { z } from "zod"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity-log"
import { createNotification, createNotificationForUsers } from "@/lib/notifications"
import { getEmployeeUserId, getStaffUserIds, isHealthClaimStaff } from "@/lib/health-claim"
import {
  buildLetterNumber,
  buildMemoDraftRows,
  getMemoSettings,
  nextMemoSequence,
  resolveMemoSteps,
  type ResolvedStep,
} from "@/lib/health-claim-memo"
import { DISPOSITION_LABEL, formatRupiah } from "@/lib/health-claim-labels"

// Nota Dinas klaim kesehatan — docs/prd-klaim-kesehatan.md 5.3–5.4.

export type MemoActionResult = { error: string } | { success: string; publicId?: string }

const MEMO_BASE = "/pegawai/pemeriksaan-klaim/nota-dinas"
const APPROVAL_BASE = "/pegawai/persetujuan-nota-dinas"

// Tipe diambil dari client project (yang memakai $extends), bukan Prisma.TransactionClient.
type Tx = Pick<typeof prisma, "healthClaim" | "healthClaimMemo" | "healthClaimMemoItem" | "healthClaimMemoStep">
type Actor = { userId: number; username: string; employeeId: number | null; role: string; name: string }

async function currentActor(): Promise<Actor | null> {
  const session = await auth()
  const user = session?.user
  if (!user) return null
  const employee = user.employeeId
    ? await prisma.employee.findUnique({ where: { id: user.employeeId }, select: { fullName: true } })
    : null
  return {
    userId: Number(user.id),
    username: user.username,
    employeeId: user.employeeId ?? null,
    role: user.role,
    name: employee?.fullName ?? user.username,
  }
}

async function isPetugas(actor: Actor) {
  return actor.role === "SUPER_ADMIN" || (await isHealthClaimStaff(actor.employeeId, "PETUGAS"))
}

function revalidateMemo(publicId?: string) {
  for (const base of [MEMO_BASE, APPROVAL_BASE, "/admin/payroll/klaim-kesehatan/nota-dinas"]) {
    revalidatePath(base)
    if (publicId) revalidatePath(`${base}/${publicId}`)
  }
  revalidatePath("/pegawai/pemeriksaan-klaim")
  revalidatePath("/admin/payroll/klaim-kesehatan")
  revalidatePath("/pegawai/klaim-kesehatan")
  revalidatePath("/pegawai/approval-center")
  revalidatePath("/admin/approval-center")
}

async function notifyEmployee(employeeId: number, title: string, message: string, link: string) {
  const userId = await getEmployeeUserId(employeeId)
  if (userId) await createNotification({ userId, title, message, link })
}

async function notifyClaimOwners(
  claims: { employeeId: number; claimNumber: string; publicId: string }[],
  title: string,
  message: (claimNumber: string) => string
) {
  for (const c of claims) {
    await notifyEmployee(c.employeeId, title, message(c.claimNumber), `/pegawai/klaim-kesehatan/${c.publicId}`)
  }
}

function stepCreateData(steps: ResolvedStep[], round: number) {
  const firstActive = steps.find((s) => !s.skipped)
  return steps.map((s) => ({
    round,
    order: s.order,
    type: s.type,
    label: s.label,
    approverEmployeeId: s.approverEmployeeId,
    canAdjust: s.canAdjust,
    status: s.skipped ? ("DILEWATI" as const) : s === firstActive ? ("AKTIF" as const) : ("MENUNGGU" as const),
  }))
}

async function notifyActiveApprover(memoId: number) {
  const memo = await prisma.healthClaimMemo.findUnique({
    where: { id: memoId },
    select: {
      publicId: true,
      memoNumber: true,
      totalAmount: true,
      round: true,
      steps: { where: { status: "AKTIF" }, select: { approverEmployeeId: true, type: true, label: true } },
      _count: { select: { items: true } },
    },
  })
  const step = memo?.steps[0]
  if (!memo || !step?.approverEmployeeId) return
  await notifyEmployee(
    step.approverEmployeeId,
    step.type === "DISPOSISI_DIREKTUR" ? "Nota Dinas menunggu disposisi" : "Nota Dinas menunggu persetujuan",
    `Nota Dinas ${memo.memoNumber} (${memo._count.items} klaim, ${formatRupiah(memo.totalAmount)}) menunggu tindakan Anda sebagai ${step.label}.`,
    `${APPROVAL_BASE}/${memo.publicId}`
  )
}

// ── Membuat Nota Dinas ──────────────────────────────────────

const createSchema = z.object({
  claimPublicIds: z.array(z.string().min(1)).min(1, "Pilih minimal satu klaim"),
  memoDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal Nota Dinas tidak valid"),
  notes: z.record(z.string(), z.string().trim().max(255, "Keterangan maksimal 255 karakter")),
  toText: z.string().trim().min(1, "Kepada wajib diisi").max(255),
  fromText: z.string().trim().min(1, "Dari wajib diisi").max(255),
  subject: z.string().trim().min(1, "Perihal wajib diisi").max(255),
  opening: z.string().trim().min(1, "Teks pembuka wajib diisi").max(3000),
  closing: z.string().trim().max(3000),
  forceReason: z.string().trim().max(1000).optional(),
})

export async function createHealthClaimMemoAction(input: z.input<typeof createSchema>): Promise<MemoActionResult> {
  const actor = await currentActor()
  if (!actor || !(await isPetugas(actor))) return { error: "Hanya petugas klaim yang bisa membuat Nota Dinas." }
  if (!actor.employeeId) return { error: "Akun Anda belum terhubung ke data pegawai." }
  const parsed = createSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Data tidak valid." }
  const data = parsed.data

  const claims = await prisma.healthClaim.findMany({
    where: { publicId: { in: data.claimPublicIds } },
    select: { id: true, publicId: true, status: true, employeeId: true, claimNumber: true },
  })
  if (claims.length !== data.claimPublicIds.length || claims.some((c) => c.status !== "TERKONFIRMASI")) {
    return { error: "Sebagian klaim sudah tidak berstatus Terkonfirmasi. Muat ulang halaman." }
  }
  const settings = await getMemoSettings()
  const employeeCount = new Set(claims.map((c) => c.employeeId)).size
  let forcedReason: string | null = null
  // Syarat minimal dihitung per KLAIM (beberapa klaim dari pegawai yang sama
  // ikut dihitung masing-masing).
  if (claims.length < settings.minEmployeesPerMemo) {
    if (actor.role !== "SUPER_ADMIN") {
      return {
        error: `Nota Dinas membutuhkan minimal ${settings.minEmployeesPerMemo} klaim (saat ini ${claims.length}).`,
      }
    }
    if (!data.forceReason || data.forceReason.length < 5) {
      return { error: "Tulis alasan membuat Nota Dinas dengan klaim kurang dari minimal." }
    }
    forcedReason = data.forceReason
  }

  const steps = await resolveMemoSteps(actor.employeeId)
  if (!steps.some((s) => !s.skipped)) {
    return { error: "Alur persetujuan Nota Dinas belum diatur atau tidak menghasilkan penyetuju. Periksa Pengaturan Klaim Kesehatan." }
  }

  const rows = await buildMemoDraftRows(claims.map((c) => c.id))
  const total = rows.reduce((s, r) => s + r.amount, 0)
  const memoDate = new Date(`${data.memoDate}T00:00:00Z`)
  const today = new Date(`${new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" })}T00:00:00Z`)

  let memo: { id: number; publicId: string; memoNumber: string } | null = null
  for (let attempt = 0; attempt < 3 && !memo; attempt++) {
    try {
      memo = await prisma.$transaction(async (tx) => {
        const { seq, memoNumber } = await nextMemoSequence(tx, memoDate.getUTCFullYear())
        const created = await tx.healthClaimMemo.create({
          data: {
            memoNumber,
            letterNumber: buildLetterNumber(settings.memoLetterNumberFormat, seq, memoDate),
            memoDate,
            balanceDate: today,
            createdByEmployeeId: actor.employeeId!,
            toText: data.toText,
            fromText: data.fromText,
            subject: data.subject,
            opening: data.opening,
            closing: data.closing,
            totalAmount: total,
            forcedReason,
            items: {
              create: rows.map((r, i) => ({
                claimId: r.claimId,
                order: i + 1,
                balanceBefore: r.balanceBefore,
                amount: r.amount,
                note: data.notes[r.claimPublicId]?.trim() || r.defaultNote,
              })),
            },
            steps: { create: stepCreateData(steps, 1) },
          },
          select: { id: true, publicId: true, memoNumber: true },
        })
        const moved = await tx.healthClaim.updateMany({
          where: { id: { in: claims.map((c) => c.id) }, status: "TERKONFIRMASI" },
          data: { status: "DALAM_NOTA_DINAS" },
        })
        if (moved.count !== claims.length) throw new Error("STATUS_BERUBAH")
        await tx.healthClaimEvent.createMany({
          data: claims.map((c) => ({
            claimId: c.id,
            action: "MASUK_NOTA_DINAS",
            actorName: actor.name,
            note: `Diajukan dalam Nota Dinas ${memoNumber}.`,
          })),
        })
        return created
      })
    } catch (err) {
      if (err instanceof Error && err.message === "STATUS_BERUBAH") {
        return { error: "Sebagian klaim sudah diproses di tempat lain. Muat ulang halaman." }
      }
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002" && attempt < 2) continue
      throw err
    }
  }
  if (!memo) return { error: "Gagal membuat nomor Nota Dinas. Coba lagi." }

  await logActivity({
    userId: actor.userId,
    username: actor.username,
    action: "CREATE",
    entityType: "HealthClaimMemo",
    description: `${actor.username} membuat Nota Dinas ${memo.memoNumber}: ${claims.length} klaim dari ${employeeCount} pegawai, total ${formatRupiah(total)}${forcedReason ? ` (kurang dari minimal: ${forcedReason})` : ""}.`,
  })
  await notifyActiveApprover(memo.id)
  await notifyClaimOwners(claims, "Klaim masuk Nota Dinas", (n) => `Klaim ${n} sudah diajukan ke Direksi dalam Nota Dinas ${memo!.memoNumber}.`)
  revalidateMemo(memo.publicId)
  return { success: `Nota Dinas ${memo.memoNumber} dibuat dan dikirim untuk persetujuan.`, publicId: memo.publicId }
}

// ── Tindakan penyetuju ─────────────────────────────────────

async function loadMemoForAction(publicId: string) {
  return prisma.healthClaimMemo.findUnique({
    where: { publicId },
    include: {
      steps: { orderBy: { order: "asc" } },
      items: { include: { claim: { select: { id: true, publicId: true, claimNumber: true, employeeId: true } } } },
    },
  })
}
type LoadedMemo = NonNullable<Awaited<ReturnType<typeof loadMemoForAction>>>

function activeStepOf(memo: LoadedMemo) {
  return memo.steps.find((s) => s.round === memo.round && s.status === "AKTIF") ?? null
}

async function requireActiveApprover(publicId: string) {
  const actor = await currentActor()
  if (!actor?.employeeId) return { error: "Akun Anda belum terhubung ke data pegawai." } as const
  const memo = await loadMemoForAction(publicId)
  if (!memo) return { error: "Nota Dinas tidak ditemukan." } as const
  if (memo.status !== "MENUNGGU_PERSETUJUAN") return { error: "Nota Dinas ini tidak sedang menunggu persetujuan." } as const
  const step = activeStepOf(memo)
  if (!step || step.approverEmployeeId !== actor.employeeId) {
    return { error: "Nota Dinas ini tidak sedang menunggu tindakan Anda." } as const
  }
  return { actor, memo, step } as const
}

// Lanjut ke langkah berikutnya; bila tidak ada lagi, Nota Dinas disetujui.
async function advance(tx: Tx, memo: LoadedMemo, currentOrder: number) {
  const next = memo.steps.find((s) => s.round === memo.round && s.order > currentOrder && s.status === "MENUNGGU")
  if (next) {
    await tx.healthClaimMemoStep.update({ where: { id: next.id }, data: { status: "AKTIF" } })
    return "NEXT" as const
  }
  await tx.healthClaimMemo.update({ where: { id: memo.id }, data: { status: "DISETUJUI" } })
  await tx.healthClaim.updateMany({
    where: { id: { in: memo.items.map((i) => i.claim.id) }, status: "DALAM_NOTA_DINAS" },
    data: { status: "DISETUJUI" },
  })
  return "DONE" as const
}

async function afterAdvance(memo: LoadedMemo, result: "NEXT" | "DONE", actorName: string) {
  if (result === "NEXT") {
    await notifyActiveApprover(memo.id)
    return
  }
  await prisma.healthClaimEvent.createMany({
    data: memo.items.map((i) => ({
      claimId: i.claim.id,
      action: "DISETUJUI_DIREKSI",
      actorName,
      note: `Nota Dinas ${memo.memoNumber} disetujui. Menunggu pembayaran.`,
    })),
  })
  await notifyClaimOwners(
    memo.items.map((i) => i.claim),
    "Klaim kesehatan disetujui",
    (n) => `Klaim ${n} disetujui Direksi melalui Nota Dinas ${memo.memoNumber} dan menunggu pembayaran.`
  )
  await notifyEmployee(
    memo.createdByEmployeeId,
    "Nota Dinas disetujui",
    `Nota Dinas ${memo.memoNumber} sudah disetujui dan siap dibayarkan.`,
    `${MEMO_BASE}/${memo.publicId}`
  )
  // Accounting melihat Nota Dinas final langsung di HRIS, tanpa cetakan.
  const fresh = await prisma.healthClaimMemo.findUnique({ where: { id: memo.id }, select: { totalAmount: true } })
  await createNotificationForUsers(await getStaffUserIds("ACCOUNTING"), {
    title: "Nota Dinas siap dibayar",
    message: `Nota Dinas ${memo.memoNumber} sudah didisposisi Direksi. Total ${formatRupiah(fresh?.totalAmount ?? memo.totalAmount)} siap dibayarkan.`,
    link: `/pegawai/pembayaran-klaim/${memo.publicId}`,
  })
}

const noteSchema = z.string().trim().min(5, "Tulis catatan minimal 5 karakter").max(1000, "Catatan maksimal 1000 karakter")

export async function approveMemoStepAction(publicId: string, note?: string): Promise<MemoActionResult> {
  const ctx = await requireActiveApprover(publicId)
  if ("error" in ctx) return { error: ctx.error as string }
  const { actor, memo, step } = ctx
  if (step.type === "DISPOSISI_DIREKTUR") return { error: "Langkah ini berupa disposisi. Gunakan formulir disposisi." }

  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.healthClaimMemoStep.updateMany({
      where: { id: step.id, status: "AKTIF" },
      data: { status: "DISETUJUI", note: note?.trim() || null, actorName: actor.name, actedAt: new Date() },
    })
    if (updated.count === 0) throw new Error("STATUS_BERUBAH")
    return advance(tx, memo, step.order)
  }).catch((err) => (err instanceof Error && err.message === "STATUS_BERUBAH" ? null : Promise.reject(err)))
  if (!result) return { error: "Nota Dinas sudah diproses. Muat ulang halaman." }

  await logActivity({
    userId: actor.userId,
    username: actor.username,
    action: "UPDATE",
    entityType: "HealthClaimMemo",
    description: `${actor.username} menyetujui Nota Dinas ${memo.memoNumber} sebagai ${step.label}.`,
  })
  await afterAdvance(memo, result, actor.name)
  revalidateMemo(memo.publicId)
  return { success: result === "DONE" ? `Nota Dinas ${memo.memoNumber} disetujui.` : "Disetujui dan diteruskan ke langkah berikutnya." }
}

// Kembalikan ke pembuat (dipakai "Kembalikan" & disposisi "Tinjau ulang").
async function returnMemo(memo: LoadedMemo, stepId: number, actor: Actor, note: string, decision?: "TINJAU_ULANG") {
  await prisma.$transaction(async (tx) => {
    const updated = await tx.healthClaimMemoStep.updateMany({
      where: { id: stepId, status: "AKTIF" },
      data: { status: "DIKEMBALIKAN", decision: decision ?? null, note, actorName: actor.name, actedAt: new Date() },
    })
    if (updated.count === 0) throw new Error("STATUS_BERUBAH")
    await tx.healthClaimMemoStep.updateMany({
      where: { memoId: memo.id, round: memo.round, status: "MENUNGGU" },
      data: { status: "DIBATALKAN" },
    })
    await tx.healthClaimMemo.update({ where: { id: memo.id }, data: { status: "DIKEMBALIKAN" } })
  })
  await notifyEmployee(
    memo.createdByEmployeeId,
    "Nota Dinas dikembalikan",
    `Nota Dinas ${memo.memoNumber} dikembalikan oleh ${actor.name}: ${note}`,
    `${MEMO_BASE}/${memo.publicId}`
  )
}

export async function returnMemoAction(publicId: string, note: string): Promise<MemoActionResult> {
  const ctx = await requireActiveApprover(publicId)
  if ("error" in ctx) return { error: ctx.error as string }
  const parsedNote = noteSchema.safeParse(note)
  if (!parsedNote.success) return { error: parsedNote.error.issues[0]?.message ?? "Catatan tidak valid." }
  try {
    await returnMemo(ctx.memo, ctx.step.id, ctx.actor, parsedNote.data)
  } catch {
    return { error: "Nota Dinas sudah diproses. Muat ulang halaman." }
  }
  await logActivity({
    userId: ctx.actor.userId,
    username: ctx.actor.username,
    action: "UPDATE",
    entityType: "HealthClaimMemo",
    description: `${ctx.actor.username} mengembalikan Nota Dinas ${ctx.memo.memoNumber}: ${parsedNote.data}`,
  })
  revalidateMemo(ctx.memo.publicId)
  return { success: `Nota Dinas ${ctx.memo.memoNumber} dikembalikan ke pembuat.` }
}

export async function dispositionMemoAction(
  publicId: string,
  decision: "SETUJU" | "SETUJU_CATATAN" | "TINJAU_ULANG" | "TIDAK_SETUJU",
  note: string
): Promise<MemoActionResult> {
  const ctx = await requireActiveApprover(publicId)
  if ("error" in ctx) return { error: ctx.error as string }
  const { actor, memo, step } = ctx
  if (step.type !== "DISPOSISI_DIREKTUR") return { error: "Langkah ini bukan disposisi." }
  if (!["SETUJU", "SETUJU_CATATAN", "TINJAU_ULANG", "TIDAK_SETUJU"].includes(decision)) {
    return { error: "Keputusan disposisi tidak dikenali." }
  }
  const trimmed = note.trim()
  if (decision !== "SETUJU" && trimmed.length < 5) return { error: "Tulis catatan disposisi minimal 5 karakter." }
  if (trimmed.length > 1000) return { error: "Catatan disposisi maksimal 1000 karakter." }

  try {
    if (decision === "TINJAU_ULANG") {
      await returnMemo(memo, step.id, actor, trimmed, "TINJAU_ULANG")
    } else if (decision === "TIDAK_SETUJU") {
      await prisma.$transaction(async (tx) => {
        const updated = await tx.healthClaimMemoStep.updateMany({
          where: { id: step.id, status: "AKTIF" },
          data: { status: "DITOLAK", decision, note: trimmed, actorName: actor.name, actedAt: new Date() },
        })
        if (updated.count === 0) throw new Error("STATUS_BERUBAH")
        await tx.healthClaimMemoStep.updateMany({
          where: { memoId: memo.id, round: memo.round, status: "MENUNGGU" },
          data: { status: "DIBATALKAN" },
        })
        await tx.healthClaimMemo.update({ where: { id: memo.id }, data: { status: "DITOLAK" } })
        await tx.healthClaim.updateMany({
          where: { id: { in: memo.items.map((i) => i.claim.id) }, status: "DALAM_NOTA_DINAS" },
          data: { status: "DITOLAK" },
        })
        await tx.healthClaimEvent.createMany({
          data: memo.items.map((i) => ({
            claimId: i.claim.id,
            action: "DITOLAK_DIREKSI",
            actorName: actor.name,
            note: `Nota Dinas ${memo.memoNumber} tidak disetujui: ${trimmed}`,
          })),
        })
      })
      await notifyClaimOwners(
        memo.items.map((i) => i.claim),
        "Klaim kesehatan tidak disetujui",
        (n) => `Klaim ${n} tidak disetujui Direksi: ${trimmed}`
      )
      await notifyEmployee(
        memo.createdByEmployeeId,
        "Nota Dinas tidak disetujui",
        `Nota Dinas ${memo.memoNumber} tidak disetujui: ${trimmed}`,
        `${MEMO_BASE}/${memo.publicId}`
      )
    } else {
      const result = await prisma.$transaction(async (tx) => {
        const updated = await tx.healthClaimMemoStep.updateMany({
          where: { id: step.id, status: "AKTIF" },
          data: { status: "DISETUJUI", decision, note: trimmed || null, actorName: actor.name, actedAt: new Date() },
        })
        if (updated.count === 0) throw new Error("STATUS_BERUBAH")
        return advance(tx, memo, step.order)
      })
      await afterAdvance(memo, result, actor.name)
    }
  } catch (err) {
    if (err instanceof Error && err.message === "STATUS_BERUBAH") return { error: "Nota Dinas sudah diproses. Muat ulang halaman." }
    throw err
  }

  await logActivity({
    userId: actor.userId,
    username: actor.username,
    action: "UPDATE",
    entityType: "HealthClaimMemo",
    description: `${actor.username} memberi disposisi "${DISPOSITION_LABEL[decision]}" pada Nota Dinas ${memo.memoNumber}${trimmed ? `: ${trimmed}` : ""}.`,
  })
  revalidateMemo(memo.publicId)
  return { success: `Disposisi "${DISPOSITION_LABEL[decision]}" tersimpan.` }
}

// ── Penyesuaian isi Nota Dinas ──────────────────────────────

async function recomputeTotal(tx: Tx, memoId: number) {
  const items = await tx.healthClaimMemoItem.findMany({ where: { memoId }, select: { amount: true } })
  const total = items.reduce((s, i) => s + i.amount, 0)
  await tx.healthClaimMemo.update({ where: { id: memoId }, data: { totalAmount: total } })
  return { total, count: items.length }
}

export async function adjustMemoItemAction(
  memoPublicId: string,
  claimPublicId: string,
  newAmount: number,
  note: string
): Promise<MemoActionResult> {
  const ctx = await requireActiveApprover(memoPublicId)
  if ("error" in ctx) return { error: ctx.error as string }
  const { actor, memo, step } = ctx
  if (!step.canAdjust) return { error: "Langkah Anda tidak diizinkan mengubah nominal." }
  const item = memo.items.find((i) => i.claim.publicId === claimPublicId)
  if (!item) return { error: "Klaim tidak ada di Nota Dinas ini." }
  if (!Number.isInteger(newAmount) || newAmount <= 0) return { error: "Nominal baru harus lebih dari 0. Gunakan Keluarkan bila klaim tidak dibayar." }
  if (newAmount >= item.amount) return { error: "Nominal hanya bisa diturunkan." }
  const parsedNote = noteSchema.safeParse(note)
  if (!parsedNote.success) return { error: parsedNote.error.issues[0]?.message ?? "Alasan tidak valid." }

  await prisma.$transaction(async (tx) => {
    await tx.healthClaimMemoItem.update({ where: { id: item.id }, data: { amount: newAmount } })
    await tx.healthClaim.update({ where: { id: item.claim.id }, data: { approvedAmount: newAmount } })
    await tx.healthClaimEvent.create({
      data: {
        claimId: item.claim.id,
        action: "NOMINAL_DIUBAH",
        actorName: actor.name,
        note: `Nominal diubah dari ${formatRupiah(item.amount)} menjadi ${formatRupiah(newAmount)} di Nota Dinas ${memo.memoNumber}: ${parsedNote.data}`,
      },
    })
    await recomputeTotal(tx, memo.id)
  })
  await notifyEmployee(
    item.claim.employeeId,
    "Nominal klaim disesuaikan",
    `Nominal klaim ${item.claim.claimNumber} diubah menjadi ${formatRupiah(newAmount)}: ${parsedNote.data}`,
    `/pegawai/klaim-kesehatan/${item.claim.publicId}`
  )
  await logActivity({
    userId: actor.userId,
    username: actor.username,
    action: "UPDATE",
    entityType: "HealthClaimMemo",
    description: `${actor.username} menurunkan nominal klaim ${item.claim.claimNumber} di Nota Dinas ${memo.memoNumber} menjadi ${formatRupiah(newAmount)}.`,
  })
  revalidateMemo(memo.publicId)
  return { success: `Nominal klaim ${item.claim.claimNumber} diubah menjadi ${formatRupiah(newAmount)}.` }
}

// Keluarkan klaim dari Nota Dinas → kembali ke antrean (Terkonfirmasi).
// Bisa oleh penyetuju aktif yang diizinkan mengubah, atau petugas saat
// Nota Dinas berstatus Dikembalikan.
export async function removeMemoItemAction(
  memoPublicId: string,
  claimPublicId: string,
  note: string
): Promise<MemoActionResult> {
  const actor = await currentActor()
  if (!actor?.employeeId) return { error: "Akun Anda belum terhubung ke data pegawai." }
  const memo = await loadMemoForAction(memoPublicId)
  if (!memo) return { error: "Nota Dinas tidak ditemukan." }
  const step = activeStepOf(memo)
  const asApprover =
    memo.status === "MENUNGGU_PERSETUJUAN" && step?.approverEmployeeId === actor.employeeId && step.canAdjust
  const asPetugas = memo.status === "DIKEMBALIKAN" && (await isPetugas(actor))
  if (!asApprover && !asPetugas) return { error: "Anda tidak bisa mengubah isi Nota Dinas ini sekarang." }
  const item = memo.items.find((i) => i.claim.publicId === claimPublicId)
  if (!item) return { error: "Klaim tidak ada di Nota Dinas ini." }
  const parsedNote = noteSchema.safeParse(note)
  if (!parsedNote.success) return { error: parsedNote.error.issues[0]?.message ?? "Alasan tidak valid." }

  const { count } = await prisma.$transaction(async (tx) => {
    await tx.healthClaimMemoItem.delete({ where: { id: item.id } })
    await tx.healthClaim.update({ where: { id: item.claim.id }, data: { status: "TERKONFIRMASI" } })
    await tx.healthClaimEvent.create({
      data: {
        claimId: item.claim.id,
        action: "KELUAR_NOTA_DINAS",
        actorName: actor.name,
        note: `Dikeluarkan dari Nota Dinas ${memo.memoNumber} dan kembali ke antrean: ${parsedNote.data}`,
      },
    })
    const totals = await recomputeTotal(tx, memo.id)
    if (totals.count === 0) {
      await tx.healthClaimMemo.update({ where: { id: memo.id }, data: { status: "DIBATALKAN" } })
      await tx.healthClaimMemoStep.updateMany({
        where: { memoId: memo.id, status: { in: ["AKTIF", "MENUNGGU"] } },
        data: { status: "DIBATALKAN" },
      })
    }
    return totals
  })
  await notifyEmployee(
    item.claim.employeeId,
    "Klaim dikeluarkan dari Nota Dinas",
    `Klaim ${item.claim.claimNumber} dikeluarkan dari Nota Dinas ${memo.memoNumber} dan akan diajukan pada Nota Dinas berikutnya: ${parsedNote.data}`,
    `/pegawai/klaim-kesehatan/${item.claim.publicId}`
  )
  await logActivity({
    userId: actor.userId,
    username: actor.username,
    action: "UPDATE",
    entityType: "HealthClaimMemo",
    description: `${actor.username} mengeluarkan klaim ${item.claim.claimNumber} dari Nota Dinas ${memo.memoNumber}: ${parsedNote.data}`,
  })
  revalidateMemo(memo.publicId)
  return {
    success:
      count === 0
        ? `Klaim dikeluarkan. Nota Dinas ${memo.memoNumber} kosong sehingga dibatalkan.`
        : `Klaim ${item.claim.claimNumber} dikeluarkan dan kembali ke antrean.`,
  }
}

// ── Tindakan pembuat (petugas) saat Nota Dinas dikembalikan ─

const resubmitSchema = z.object({
  notes: z.record(z.string(), z.string().trim().max(255, "Keterangan maksimal 255 karakter")),
  opening: z.string().trim().min(1, "Teks pembuka wajib diisi").max(3000),
  closing: z.string().trim().max(3000),
})

export async function resubmitMemoAction(
  publicId: string,
  input: z.input<typeof resubmitSchema>
): Promise<MemoActionResult> {
  const actor = await currentActor()
  if (!actor?.employeeId || !(await isPetugas(actor))) return { error: "Hanya petugas klaim yang bisa mengajukan ulang." }
  const parsed = resubmitSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Data tidak valid." }
  const memo = await loadMemoForAction(publicId)
  if (!memo) return { error: "Nota Dinas tidak ditemukan." }
  if (memo.status !== "DIKEMBALIKAN") return { error: "Nota Dinas ini tidak sedang dikembalikan." }
  if (memo.items.length === 0) return { error: "Nota Dinas kosong." }

  // Alur dihitung ulang dari pembuat aslinya, dengan konfigurasi terbaru.
  const steps = await resolveMemoSteps(memo.createdByEmployeeId)
  if (!steps.some((s) => !s.skipped)) return { error: "Alur persetujuan Nota Dinas tidak menghasilkan penyetuju." }
  const rows = await buildMemoDraftRows(
    memo.items.map((i) => i.claim.id),
    memo.id
  )
  const round = memo.round + 1

  await prisma.$transaction(async (tx) => {
    for (const r of rows) {
      const item = memo.items.find((i) => i.claim.id === r.claimId)!
      await tx.healthClaimMemoItem.update({
        where: { id: item.id },
        data: {
          balanceBefore: r.balanceBefore,
          note: parsed.data.notes[r.claimPublicId]?.trim() || item.note,
        },
      })
    }
    await tx.healthClaimMemo.update({
      where: { id: memo.id },
      data: {
        status: "MENUNGGU_PERSETUJUAN",
        round,
        opening: parsed.data.opening,
        closing: parsed.data.closing,
      },
    })
    await tx.healthClaimMemoStep.createMany({ data: stepCreateData(steps, round).map((s) => ({ ...s, memoId: memo.id })) })
    await recomputeTotal(tx, memo.id)
  })
  await notifyActiveApprover(memo.id)
  await logActivity({
    userId: actor.userId,
    username: actor.username,
    action: "UPDATE",
    entityType: "HealthClaimMemo",
    description: `${actor.username} mengajukan ulang Nota Dinas ${memo.memoNumber} (putaran ${round}).`,
  })
  revalidateMemo(memo.publicId)
  return { success: `Nota Dinas ${memo.memoNumber} diajukan ulang.` }
}

export async function cancelMemoAction(publicId: string, reason: string): Promise<MemoActionResult> {
  const actor = await currentActor()
  if (!actor?.employeeId || !(await isPetugas(actor))) return { error: "Hanya petugas klaim yang bisa membatalkan Nota Dinas." }
  const parsedNote = noteSchema.safeParse(reason)
  if (!parsedNote.success) return { error: parsedNote.error.issues[0]?.message ?? "Alasan tidak valid." }
  const memo = await loadMemoForAction(publicId)
  if (!memo) return { error: "Nota Dinas tidak ditemukan." }
  // Boleh dibatalkan saat dikembalikan, atau saat belum ada satu pun tindakan
  // di putaran berjalan.
  const actedThisRound = memo.steps.some(
    (s) => s.round === memo.round && ["DISETUJUI", "DIKEMBALIKAN", "DITOLAK"].includes(s.status)
  )
  const cancellable = memo.status === "DIKEMBALIKAN" || (memo.status === "MENUNGGU_PERSETUJUAN" && !actedThisRound)
  if (!cancellable) return { error: "Nota Dinas yang sudah diproses penyetuju tidak bisa dibatalkan." }

  await prisma.$transaction(async (tx) => {
    await tx.healthClaimMemo.update({ where: { id: memo.id }, data: { status: "DIBATALKAN" } })
    await tx.healthClaimMemoStep.updateMany({
      where: { memoId: memo.id, status: { in: ["AKTIF", "MENUNGGU"] } },
      data: { status: "DIBATALKAN" },
    })
    await tx.healthClaim.updateMany({
      where: { id: { in: memo.items.map((i) => i.claim.id) }, status: "DALAM_NOTA_DINAS" },
      data: { status: "TERKONFIRMASI" },
    })
    // Baris item dibiarkan sebagai arsip Nota Dinas yang dibatalkan; klaimnya
    // kembali Terkonfirmasi sehingga bisa masuk Nota Dinas berikutnya.
    await tx.healthClaimEvent.createMany({
      data: memo.items.map((i) => ({
        claimId: i.claim.id,
        action: "KELUAR_NOTA_DINAS",
        actorName: actor.name,
        note: `Nota Dinas ${memo.memoNumber} dibatalkan, klaim kembali ke antrean: ${parsedNote.data}`,
      })),
    })
  })
  await logActivity({
    userId: actor.userId,
    username: actor.username,
    action: "UPDATE",
    entityType: "HealthClaimMemo",
    description: `${actor.username} membatalkan Nota Dinas ${memo.memoNumber}: ${parsedNote.data}`,
  })
  revalidateMemo(memo.publicId)
  return { success: `Nota Dinas ${memo.memoNumber} dibatalkan. Klaimnya kembali ke antrean.` }
}
