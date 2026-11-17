"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity-log"
import { MONTH_NAMES, plafonPeriodYear } from "@/lib/health-claim-labels"

// Pengaturan Klaim Kesehatan — lihat docs/prd-klaim-kesehatan.md bagian 5.6.

export type SettingsActionResult = { error: string } | { success: string }

const SETTINGS_PATH = "/admin/payroll/klaim-kesehatan/pengaturan"

async function requireSettingsAccess() {
  const session = await auth()
  const user = session?.user
  const allowed =
    user?.role === "SUPER_ADMIN" ||
    (user?.role === "HR_ADMIN" && user.menuAccess.includes("payroll.klaim-kesehatan-pengaturan"))
  return allowed ? user! : null
}

async function log(user: { id: string; username: string }, description: string) {
  await logActivity({
    userId: Number(user.id),
    username: user.username,
    action: "UPDATE",
    entityType: "HealthClaimSettings",
    description: `${user.username} ${description}`,
  })
}

const NO_ACCESS = { error: "Anda tidak punya akses ke Pengaturan Klaim Kesehatan." }

const generalSchema = z.object({
  minEmployeesPerMemo: z.coerce.number().int().min(1, "Minimal 1 klaim").max(100, "Maksimal 100 klaim"),
  deadlineEnabled: z.boolean(),
  submissionDeadlineDays: z.coerce.number().int().min(1, "Minimal 1 hari").max(365, "Maksimal 365 hari"),
  plafonStartMonth: z.coerce.number().int().min(1, "Bulan tidak valid").max(12, "Bulan tidak valid"),
})

export async function saveHealthClaimGeneralAction(input: {
  minEmployeesPerMemo: number
  deadlineEnabled: boolean
  submissionDeadlineDays: number
  plafonStartMonth: number
}): Promise<SettingsActionResult> {
  const user = await requireSettingsAccess()
  if (!user) return NO_ACCESS
  const parsed = generalSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Data tidak valid." }

  const { minEmployeesPerMemo, deadlineEnabled, submissionDeadlineDays, plafonStartMonth } = parsed.data
  const before = await prisma.healthClaimSettings.findUnique({ where: { id: 1 }, select: { plafonStartMonth: true } })
  const data = {
    minEmployeesPerMemo,
    submissionDeadlineDays: deadlineEnabled ? submissionDeadlineDays : null,
    plafonStartMonth,
  }
  await prisma.healthClaimSettings.upsert({ where: { id: 1 }, create: { id: 1, ...data }, update: data })

  // Periode plafon berubah → periode semua klaim dihitung ulang dari tanggal
  // berobatnya, supaya sisa plafon & rekap memakai aturan yang sama.
  let recalculated = 0
  if ((before?.plafonStartMonth ?? 1) !== plafonStartMonth) {
    const claims = await prisma.healthClaim.findMany({ select: { id: true, treatmentDate: true, plafonYear: true } })
    const changes = claims
      .map((c) => ({
        id: c.id,
        next: plafonPeriodYear(c.treatmentDate.getUTCFullYear(), c.treatmentDate.getUTCMonth(), plafonStartMonth),
        prev: c.plafonYear,
      }))
      .filter((c) => c.next !== c.prev)
    await prisma.$transaction(
      changes.map((c) => prisma.healthClaim.update({ where: { id: c.id }, data: { plafonYear: c.next } }))
    )
    recalculated = changes.length
  }

  await log(
    user,
    `mengubah pengaturan umum klaim kesehatan: minimal ${minEmployeesPerMemo} klaim per Nota Dinas, batas pengajuan ${
      deadlineEnabled ? `${submissionDeadlineDays} hari` : "tidak dibatasi"
    }, periode plafon mulai ${MONTH_NAMES[plafonStartMonth - 1]}${recalculated ? ` (${recalculated} klaim dipindah periodenya)` : ""}.`
  )
  revalidatePath(SETTINGS_PATH)
  revalidatePath("/pegawai/klaim-kesehatan")
  revalidatePath("/admin/payroll/klaim-kesehatan/rekap")
  return {
    success: recalculated
      ? `Pengaturan umum disimpan. Periode ${recalculated} klaim yang sudah ada disesuaikan.`
      : "Pengaturan umum disimpan.",
  }
}

export async function saveHealthClaimStaffAction(
  role: "PETUGAS" | "ACCOUNTING",
  employeeIds: number[]
): Promise<SettingsActionResult> {
  const user = await requireSettingsAccess()
  if (!user) return NO_ACCESS
  if (role !== "PETUGAS" && role !== "ACCOUNTING") return { error: "Peran tidak dikenali." }

  const ids = [...new Set(employeeIds.filter((id) => Number.isInteger(id) && id > 0))]
  const employees = await prisma.employee.findMany({
    where: { id: { in: ids }, isDeleted: false },
    select: { id: true, fullName: true },
  })

  await prisma.$transaction([
    prisma.healthClaimStaff.deleteMany({ where: { role, employeeId: { notIn: employees.map((e) => e.id) } } }),
    ...employees.map((e) =>
      prisma.healthClaimStaff.upsert({
        where: { employeeId_role: { employeeId: e.id, role } },
        create: { employeeId: e.id, role },
        update: {},
      })
    ),
  ])

  const label = role === "PETUGAS" ? "petugas klaim" : "Accounting klaim"
  await log(
    user,
    `mengatur ${label} kesehatan: ${employees.length ? employees.map((e) => e.fullName).join(", ") : "(kosong)"}.`
  )
  revalidatePath(SETTINGS_PATH)
  return { success: `Daftar ${label} disimpan.` }
}

export async function saveEligibleStatusesAction(statusIds: number[]): Promise<SettingsActionResult> {
  const user = await requireSettingsAccess()
  if (!user) return NO_ACCESS

  const statuses = await prisma.employmentStatus.findMany({
    where: { id: { in: statusIds.filter((id) => Number.isInteger(id)) } },
    select: { id: true, name: true },
  })
  await prisma.$transaction([
    prisma.healthClaimEligibleStatus.deleteMany({}),
    prisma.healthClaimEligibleStatus.createMany({ data: statuses.map((s) => ({ employmentStatusId: s.id })) }),
  ])
  await log(
    user,
    `mengatur status kepegawaian yang berhak klaim kesehatan: ${statuses.map((s) => s.name).join(", ") || "(tidak ada)"}.`
  )
  revalidatePath(SETTINGS_PATH)
  return { success: "Status kepegawaian yang berhak disimpan." }
}

const plafonSchema = z.array(
  z.object({
    positionId: z.number().int().positive(),
    amount: z.number().int().min(0).max(2_000_000_000).nullable(),
  })
)

// amount null = plafon jabatan itu dikosongkan (pegawainya tidak bisa klaim).
export async function savePlafonsAction(
  entries: { positionId: number; amount: number | null }[]
): Promise<SettingsActionResult> {
  const user = await requireSettingsAccess()
  if (!user) return NO_ACCESS
  const parsed = plafonSchema.safeParse(entries)
  if (!parsed.success) return { error: "Nominal plafon tidak valid (harus angka bulat, maks. Rp 2 miliar)." }

  const positions = await prisma.position.findMany({ select: { id: true } })
  const valid = new Set(positions.map((p) => p.id))
  const rows = parsed.data.filter((e) => valid.has(e.positionId))

  await prisma.$transaction(
    rows.map((e) =>
      e.amount === null
        ? prisma.healthClaimPlafon.deleteMany({ where: { positionId: e.positionId } })
        : prisma.healthClaimPlafon.upsert({
            where: { positionId: e.positionId },
            create: { positionId: e.positionId, amount: e.amount },
            update: { amount: e.amount },
          })
    )
  )
  const filled = rows.filter((r) => r.amount !== null).length
  await log(user, `memperbarui plafon klaim kesehatan per jabatan (${filled} jabatan terisi).`)
  revalidatePath(SETTINGS_PATH)
  return { success: "Plafon per jabatan disimpan." }
}

const typeSchema = z.object({
  name: z.string().trim().min(1, "Nama jenis klaim wajib diisi").max(120, "Nama maksimal 120 karakter"),
  description: z.string().trim().max(1000).optional(),
  requiredDocumentLabel: z.string().trim().max(150, "Keterangan bukti maksimal 150 karakter").optional(),
  isActive: z.boolean(),
  sortOrder: z.coerce.number().int().min(0).max(999),
})

export async function saveClaimTypeAction(
  publicId: string | null,
  input: { name: string; description?: string; requiredDocumentLabel?: string; isActive: boolean; sortOrder: number }
): Promise<SettingsActionResult> {
  const user = await requireSettingsAccess()
  if (!user) return NO_ACCESS
  const parsed = typeSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Data tidak valid." }

  const data = {
    name: parsed.data.name,
    description: parsed.data.description || null,
    requiredDocumentLabel: parsed.data.requiredDocumentLabel || null,
    isActive: parsed.data.isActive,
    sortOrder: parsed.data.sortOrder,
  }

  const duplicate = await prisma.healthClaimType.findFirst({
    where: { name: data.name, ...(publicId ? { publicId: { not: publicId } } : {}) },
    select: { id: true },
  })
  if (duplicate) return { error: `Jenis klaim "${data.name}" sudah ada.` }

  if (publicId) {
    const existing = await prisma.healthClaimType.findUnique({ where: { publicId }, select: { id: true } })
    if (!existing) return { error: "Jenis klaim tidak ditemukan." }
    await prisma.healthClaimType.update({ where: { publicId }, data })
  } else {
    await prisma.healthClaimType.create({ data })
  }
  await log(user, `${publicId ? "mengubah" : "menambahkan"} jenis klaim kesehatan "${data.name}".`)
  revalidatePath(SETTINGS_PATH)
  return { success: `Jenis klaim "${data.name}" disimpan.` }
}

export async function deleteClaimTypeAction(publicId: string): Promise<SettingsActionResult> {
  const user = await requireSettingsAccess()
  if (!user) return NO_ACCESS
  const type = await prisma.healthClaimType.findUnique({
    where: { publicId },
    select: { id: true, name: true, _count: { select: { claims: true } } },
  })
  if (!type) return { error: "Jenis klaim tidak ditemukan." }
  if (type._count.claims > 0) {
    return { error: `"${type.name}" sudah dipakai ${type._count.claims} klaim. Nonaktifkan saja agar tidak bisa dipilih lagi.` }
  }
  await prisma.healthClaimType.delete({ where: { id: type.id } })
  await log(user, `menghapus jenis klaim kesehatan "${type.name}".`)
  revalidatePath(SETTINGS_PATH)
  return { success: `Jenis klaim "${type.name}" dihapus.` }
}

// ── Nota Dinas: format surat & alur persetujuan ─────────────

const memoFormatSchema = z.object({
  memoTo: z.string().trim().min(1, "Kepada wajib diisi").max(255),
  memoFrom: z.string().trim().min(1, "Dari wajib diisi").max(255),
  memoSubject: z.string().trim().min(1, "Perihal wajib diisi").max(255),
  memoOpening: z.string().trim().min(1, "Teks pembuka wajib diisi").max(3000),
  memoClosing: z.string().trim().max(3000),
  memoLetterNumberFormat: z.string().trim().max(100, "Format nomor maksimal 100 karakter").optional(),
})

export async function saveMemoFormatAction(input: z.input<typeof memoFormatSchema>): Promise<SettingsActionResult> {
  const user = await requireSettingsAccess()
  if (!user) return NO_ACCESS
  const parsed = memoFormatSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Data tidak valid." }
  const data = { ...parsed.data, memoLetterNumberFormat: parsed.data.memoLetterNumberFormat || null }
  await prisma.healthClaimSettings.upsert({ where: { id: 1 }, create: { id: 1, ...data }, update: data })
  await log(user, "mengubah format Nota Dinas klaim kesehatan.")
  revalidatePath(SETTINGS_PATH)
  return { success: "Format Nota Dinas disimpan." }
}

const flowSchema = z
  .array(
    z.object({
      type: z.enum(["ATASAN_LANGSUNG", "KEPALA_DEPARTEMEN", "PEGAWAI_TERTENTU", "DISPOSISI_DIREKTUR"]),
      label: z.string().trim().min(1, "Label setiap langkah wajib diisi").max(150, "Label maksimal 150 karakter"),
      approverEmployeeId: z.number().int().positive().nullable(),
      canAdjust: z.boolean(),
    })
  )
  .min(1, "Alur minimal berisi satu langkah")
  .max(10, "Alur maksimal 10 langkah")

export async function saveMemoFlowAction(steps: z.input<typeof flowSchema>): Promise<SettingsActionResult> {
  const user = await requireSettingsAccess()
  if (!user) return NO_ACCESS
  const parsed = flowSchema.safeParse(steps)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Data tidak valid." }
  for (const [i, s] of parsed.data.entries()) {
    const needsApprover = s.type === "PEGAWAI_TERTENTU" || s.type === "DISPOSISI_DIREKTUR"
    if (needsApprover && !s.approverEmployeeId) return { error: `Pilih pegawai untuk langkah ${i + 1} (${s.label}).` }
  }
  const ids = parsed.data.map((s) => s.approverEmployeeId).filter((id): id is number => id !== null)
  const found = await prisma.employee.count({ where: { id: { in: ids }, isDeleted: false } })
  if (found !== new Set(ids).size) return { error: "Sebagian pegawai yang dipilih tidak ditemukan." }

  await prisma.$transaction([
    prisma.healthClaimMemoFlowStep.deleteMany({}),
    prisma.healthClaimMemoFlowStep.createMany({
      data: parsed.data.map((s, i) => ({
        order: i + 1,
        type: s.type,
        label: s.label,
        approverEmployeeId: s.type === "PEGAWAI_TERTENTU" || s.type === "DISPOSISI_DIREKTUR" ? s.approverEmployeeId : null,
        canAdjust: s.canAdjust,
      })),
    }),
  ])
  await log(user, `mengubah alur persetujuan Nota Dinas klaim kesehatan (${parsed.data.map((s) => s.label).join(" → ")}).`)
  revalidatePath(SETTINGS_PATH)
  return { success: "Alur persetujuan Nota Dinas disimpan. Berlaku untuk Nota Dinas berikutnya." }
}
