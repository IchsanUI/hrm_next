"use server"

import { Prisma } from "@prisma/client"
import { revalidatePath } from "next/cache"
import { z } from "zod"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity-log"
import { encryptField } from "@/lib/encryption"
import { createNotificationForUsers } from "@/lib/notifications"
import {
  getClaimEligibility,
  getHealthClaimSettings,
  getPlafonSummary,
  getStaffUserIds,
  nextClaimNumber,
} from "@/lib/health-claim"
import { deleteClaimFile, validateClaimFile, writeClaimFile, type ValidatedClaimFile } from "@/lib/health-claim-storage"
import { formatRupiah, plafonPeriodYearOfIso } from "@/lib/health-claim-labels"

// Pengajuan klaim kesehatan oleh pegawai — docs/prd-klaim-kesehatan.md 5.1.

export type SubmitClaimResult = { error: string } | { success: string; publicId: string }

// Bukti klaim (kuitansi/nota beserta dokumen pendukung) — dibatasi supaya
// arsipnya tetap rapi dan muat dalam satu kiriman.
const MAX_FILES = 5

function todayJakartaIso() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" })
}

function daysBetween(fromIso: string, toIso: string) {
  return Math.round((Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) / 86_400_000)
}

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal tidak valid")

const claimSchema = z.object({
  patient: z.string().regex(/^(SELF|SPOUSE|CHILD:\d+)$/, "Pilih pasien"),
  typePublicId: z.string().min(1, "Pilih jenis klaim"),
  treatmentDate: isoDate,
  dischargeDate: isoDate.optional().or(z.literal("")),
  facility: z.string().trim().min(1, "Nama fasilitas kesehatan wajib diisi").max(200, "Nama fasilitas maksimal 200 karakter"),
  diagnosis: z.string().trim().max(1000, "Diagnosa maksimal 1000 karakter").optional(),
  // Pegawai cukup mengisi total yang diklaim; rinciannya diperiksa petugas
  // dari kuitansi. Urusan BPJS adalah administrasi pribadi pegawai.
  amount: z
    .number({ message: "Isi jumlah yang diklaim" })
    .int("Jumlah harus angka bulat")
    .positive("Jumlah yang diklaim harus lebih dari 0")
    .max(1_000_000_000, "Jumlah terlalu besar"),
  statementAgreed: z.literal(true, { message: "Centang pernyataan terlebih dahulu" }),
})

function filesFrom(formData: FormData, key: string) {
  return formData.getAll(key).filter((f): f is File => f instanceof File && f.size > 0)
}

type KeptDocument = { kind: "KUITANSI" | "PENDUKUNG" }

// Validasi bersama untuk pengajuan baru & perbaikan (revisi). keptDocs =
// bukti lama yang dipertahankan saat perbaikan, ikut dihitung untuk syarat
// kuitansi/bukti wajib.
async function prepareClaim(
  formData: FormData,
  employeeId: number,
  keptDocs: KeptDocument[] = [],
  options: { skipDeadline?: boolean; allowInactiveTypeId?: number } = {}
) {
  const parsed = claimSchema.safeParse({
    patient: formData.get("patient"),
    typePublicId: formData.get("typePublicId"),
    treatmentDate: formData.get("treatmentDate"),
    dischargeDate: formData.get("dischargeDate") ?? "",
    facility: formData.get("facility"),
    diagnosis: formData.get("diagnosis") ?? "",
    amount: Number(String(formData.get("amount") ?? "").replace(/\D/g, "")) || 0,
    statementAgreed: formData.get("statementAgreed") === "on",
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Data klaim tidak valid." }

  const eligibility = await getClaimEligibility(employeeId)
  if (!eligibility.eligible) return { error: eligibility.reason }

  const claimType = await prisma.healthClaimType.findUnique({ where: { publicId: parsed.data.typePublicId } })
  // Jenis yang sudah dinonaktifkan masih boleh dipakai saat memperbaiki klaim lama.
  if (!claimType || (!claimType.isActive && claimType.id !== options.allowInactiveTypeId)) {
    return { error: "Jenis klaim tidak tersedia." }
  }
  // Disimpan sebagai satu baris rincian supaya petugas tetap bisa menyesuaikan
  // nominalnya dengan alasan (lihat konfirmasi petugas).
  const data = {
    ...parsed.data,
    items: [{ description: `Total klaim ${claimType.name.toLowerCase()}`, amount: parsed.data.amount }],
    bpjsCovered: 0,
  }

  // Tanggal berobat & batas waktu pengajuan.
  const today = todayJakartaIso()
  if (data.treatmentDate > today) return { error: "Tanggal berobat tidak boleh di masa depan." }
  if (data.dischargeDate && data.dischargeDate < data.treatmentDate) {
    return { error: "Tanggal keluar tidak boleh sebelum tanggal masuk." }
  }
  if (data.dischargeDate && data.dischargeDate > today) return { error: "Tanggal keluar tidak boleh di masa depan." }
  const settings = await getHealthClaimSettings()
  // Untuk rawat inap, batas dihitung dari tanggal keluar. Perbaikan klaim
  // (revisi) tidak dicek lagi — pengajuan awalnya sudah lolos batas waktu.
  const referenceDate = data.dischargeDate || data.treatmentDate
  if (
    !options.skipDeadline &&
    settings.submissionDeadlineDays !== null &&
    daysBetween(referenceDate, today) > settings.submissionDeadlineDays
  ) {
    return {
      error: `Batas pengajuan klaim adalah ${settings.submissionDeadlineDays} hari setelah tanggal berobat. Hubungi petugas bila ada alasan khusus.`,
    }
  }

  // Pasien harus diri sendiri atau keluarga yang terdaftar.
  let patientType: "SELF" | "SPOUSE" | "CHILD" = "SELF"
  let childId: number | null = null
  let patientName = ""
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: {
      fullName: true,
      employeeNumber: true,
      spouse: { select: { fullName: true } },
      children: { select: { id: true, fullName: true } },
    },
  })
  if (!employee) return { error: "Data pegawai tidak ditemukan." }
  if (data.patient === "SELF") {
    patientName = employee.fullName
  } else if (data.patient === "SPOUSE") {
    if (!employee.spouse) return { error: "Data suami/istri belum terdaftar di data Keluarga. Hubungi HR." }
    patientType = "SPOUSE"
    patientName = employee.spouse.fullName
  } else {
    const id = Number(data.patient.split(":")[1])
    const child = employee.children.find((c) => c.id === id)
    if (!child) return { error: "Anak yang dipilih tidak terdaftar di data Keluarga." }
    patientType = "CHILD"
    childId = child.id
    patientName = child.fullName
  }

  const totalCost = data.amount
  const requestedAmount = data.amount

  // Bukti: satu kelompok (kuitansi/nota beserta dokumen pendukungnya).
  const files = filesFrom(formData, "receipts")
  if (files.length + keptDocs.length === 0) return { error: "Unggah minimal satu foto/scan kuitansi atau nota." }
  if (files.length + keptDocs.length > MAX_FILES) {
    return { error: `Maksimal ${MAX_FILES} file bukti per klaim.` }
  }

  const validated: { kind: "KUITANSI" | "PENDUKUNG"; file: ValidatedClaimFile }[] = []
  for (const f of files) {
    const result = await validateClaimFile(f)
    if ("error" in result) return { error: result.error }
    validated.push({ kind: "KUITANSI", file: result })
  }

  return {
    data,
    eligibility,
    claimType,
    today,
    patientType,
    childId,
    patientName,
    employee,
    totalCost,
    requestedAmount,
    validated,
    plafonYear: plafonPeriodYearOfIso(data.treatmentDate, settings.plafonStartMonth),
  }
}

export async function submitHealthClaimAction(formData: FormData): Promise<SubmitClaimResult> {
  const session = await auth()
  const user = session?.user
  if (!user?.employeeId) return { error: "Akun Anda belum terhubung ke data pegawai." }
  const employeeId = user.employeeId

  const prepared = await prepareClaim(formData, employeeId)
  if ("error" in prepared) return { error: prepared.error as string }
  const {
    data,
    eligibility,
    claimType,
    today,
    patientType,
    childId,
    patientName,
    employee,
    totalCost,
    requestedAmount,
    validated,
    plafonYear,
  } = prepared

  const stored: string[] = []
  try {
    for (const v of validated) stored.push(await writeClaimFile(v.file))

    let claim: { id: number; publicId: string; claimNumber: string } | null = null
    // Nomor klaim unik; coba ulang bila dua pengajuan bersamaan mendapat nomor sama.
    for (let attempt = 0; attempt < 3 && !claim; attempt++) {
      try {
        claim = await prisma.$transaction(async (tx) => {
          const claimNumber = await nextClaimNumber(tx, Number(today.slice(0, 4)))
          return tx.healthClaim.create({
            data: {
              claimNumber,
              employeeId,
              claimTypeId: claimType.id,
              patientType,
              childId,
              patientName,
              treatmentDate: new Date(`${data.treatmentDate}T00:00:00Z`),
              dischargeDate: data.dischargeDate ? new Date(`${data.dischargeDate}T00:00:00Z`) : null,
              plafonYear,
              facility: data.facility,
              diagnosis: data.diagnosis ? encryptField(data.diagnosis) : null,
              totalCost,
              bpjsCovered: data.bpjsCovered,
              requestedAmount,
              statementAgreed: true,
              items: { create: data.items.map((item, i) => ({ order: i + 1, description: item.description, amount: item.amount })) },
              documents: {
                create: validated.map((v, i) => ({
                  kind: v.kind,
                  storedFileName: stored[i],
                  originalName: v.file.originalName,
                  sizeBytes: v.file.buffer.length,
                })),
              },
              events: { create: { action: "DIAJUKAN", actorName: employee.fullName } },
            },
            select: { id: true, publicId: true, claimNumber: true },
          })
        })
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002" && attempt < 2) continue
        throw err
      }
    }
    if (!claim) throw new Error("Gagal membuat nomor klaim.")

    const summary = await getPlafonSummary(employeeId, plafonYear, eligibility.plafon)
    // Ringkasan ini sudah termasuk klaim baru — negatif berarti melebihi plafon.
    const overPlafon = summary.plafon - summary.used - summary.inProgress < 0

    await logActivity({
      userId: Number(user.id),
      username: user.username,
      action: "CREATE",
      entityType: "HealthClaim",
      description: `${user.username} mengajukan klaim kesehatan ${claim.claimNumber} sebesar ${formatRupiah(requestedAmount)} (${claimType.name}).`,
    })
    await createNotificationForUsers(await getStaffUserIds("PETUGAS"), {
      title: "Klaim kesehatan baru",
      message: `${employee.fullName} (${employee.employeeNumber}) mengajukan klaim ${claim.claimNumber} sebesar ${formatRupiah(requestedAmount)}.`,
      link: `/pegawai/pemeriksaan-klaim/${claim.publicId}`,
    })

    revalidatePath("/pegawai/klaim-kesehatan")
    revalidatePath("/admin/payroll/klaim-kesehatan")
  revalidatePath("/pegawai/pemeriksaan-klaim")
    return {
      success: overPlafon
        ? `Klaim ${claim.claimNumber} terkirim. Nominalnya melebihi sisa plafon, jadi yang dapat dibayar hanya sebesar sisa plafon.`
        : `Klaim ${claim.claimNumber} terkirim dan menunggu konfirmasi petugas.`,
      publicId: claim.publicId,
    }
  } catch (err) {
    // Jangan tinggalkan file yatim bila penyimpanan ke database gagal.
    await Promise.all(stored.map((name) => deleteClaimFile(name)))
    console.error("Gagal menyimpan klaim kesehatan:", err)
    return { error: "Klaim gagal disimpan. Coba lagi." }
  }
}

export async function cancelHealthClaimAction(publicId: string): Promise<{ error: string } | { success: string }> {
  const session = await auth()
  const user = session?.user
  if (!user?.employeeId) return { error: "Akun Anda belum terhubung ke data pegawai." }

  const claim = await prisma.healthClaim.findUnique({
    where: { publicId },
    select: { id: true, employeeId: true, status: true, claimNumber: true, employee: { select: { fullName: true } } },
  })
  if (!claim || claim.employeeId !== user.employeeId) return { error: "Klaim tidak ditemukan." }
  if (claim.status !== "MENUNGGU_KONFIRMASI" && claim.status !== "REVISI") {
    return { error: "Klaim yang sudah dikonfirmasi petugas tidak bisa dibatalkan." }
  }

  // updateMany dengan syarat status → aman dari balapan dengan petugas yang
  // sedang mengonfirmasi di saat bersamaan.
  const updated = await prisma.healthClaim.updateMany({
    where: { id: claim.id, status: { in: ["MENUNGGU_KONFIRMASI", "REVISI"] } },
    data: { status: "DIBATALKAN" },
  })
  if (updated.count === 0) return { error: "Status klaim sudah berubah. Muat ulang halaman." }
  await prisma.healthClaimEvent.create({
    data: { claimId: claim.id, action: "DIBATALKAN", actorName: claim.employee.fullName },
  })
  await logActivity({
    userId: Number(user.id),
    username: user.username,
    action: "UPDATE",
    entityType: "HealthClaim",
    description: `${user.username} membatalkan klaim kesehatan ${claim.claimNumber}.`,
  })
  revalidatePath("/pegawai/klaim-kesehatan")
  revalidatePath(`/pegawai/klaim-kesehatan/${publicId}`)
  revalidatePath("/admin/payroll/klaim-kesehatan")
  revalidatePath("/pegawai/pemeriksaan-klaim")
  return { success: `Klaim ${claim.claimNumber} dibatalkan.` }
}

// Perbaikan klaim oleh pegawai setelah petugas meminta revisi. Klaim kembali
// ke antrean konfirmasi; urutan pengajuannya (submittedAt) tetap yang lama.
export async function resubmitHealthClaimAction(publicId: string, formData: FormData): Promise<SubmitClaimResult> {
  const session = await auth()
  const user = session?.user
  if (!user?.employeeId) return { error: "Akun Anda belum terhubung ke data pegawai." }
  const employeeId = user.employeeId

  const claim = await prisma.healthClaim.findUnique({
    where: { publicId },
    select: {
      id: true,
      publicId: true,
      claimNumber: true,
      employeeId: true,
      status: true,
      claimTypeId: true,
      documents: { select: { id: true, kind: true, storedFileName: true } },
    },
  })
  if (!claim || claim.employeeId !== employeeId) return { error: "Klaim tidak ditemukan." }
  if (claim.status !== "REVISI") return { error: "Klaim ini tidak sedang diminta perbaikan." }

  const removeIds = new Set(formData.getAll("removeDocuments").map((v) => Number(v)))
  const kept = claim.documents.filter((d) => !removeIds.has(d.id))
  const removed = claim.documents.filter((d) => removeIds.has(d.id))

  const prepared = await prepareClaim(formData, employeeId, kept, {
    skipDeadline: true,
    allowInactiveTypeId: claim.claimTypeId,
  })
  if ("error" in prepared) return { error: prepared.error as string }
  const { data, claimType, patientType, childId, patientName, employee, totalCost, requestedAmount, validated, plafonYear } =
    prepared

  const stored: string[] = []
  try {
    for (const v of validated) stored.push(await writeClaimFile(v.file))
    await prisma.$transaction(async (tx) => {
      const updated = await tx.healthClaim.updateMany({
        where: { id: claim.id, status: "REVISI" },
        data: {
          status: "MENUNGGU_KONFIRMASI",
          claimTypeId: claimType.id,
          patientType,
          childId,
          patientName,
          treatmentDate: new Date(`${data.treatmentDate}T00:00:00Z`),
          dischargeDate: data.dischargeDate ? new Date(`${data.dischargeDate}T00:00:00Z`) : null,
          plafonYear,
          facility: data.facility,
          diagnosis: data.diagnosis ? encryptField(data.diagnosis) : null,
          totalCost,
          bpjsCovered: data.bpjsCovered,
          requestedAmount,
          approvedAmount: null,
          statementAgreed: true,
        },
      })
      if (updated.count === 0) throw new Error("STATUS_BERUBAH")
      await tx.healthClaimItem.deleteMany({ where: { claimId: claim.id } })
      await tx.healthClaimItem.createMany({
        data: data.items.map((item, i) => ({ claimId: claim.id, order: i + 1, description: item.description, amount: item.amount })),
      })
      if (removed.length) await tx.healthClaimDocument.deleteMany({ where: { id: { in: removed.map((d) => d.id) } } })
      if (validated.length) {
        await tx.healthClaimDocument.createMany({
          data: validated.map((v, i) => ({
            claimId: claim.id,
            kind: v.kind,
            storedFileName: stored[i],
            originalName: v.file.originalName,
            sizeBytes: v.file.buffer.length,
          })),
        })
      }
      await tx.healthClaimEvent.create({ data: { claimId: claim.id, action: "DIPERBAIKI", actorName: employee.fullName } })
    })
  } catch (err) {
    await Promise.all(stored.map((name) => deleteClaimFile(name)))
    if (err instanceof Error && err.message === "STATUS_BERUBAH") {
      return { error: "Status klaim sudah berubah. Muat ulang halaman." }
    }
    console.error("Gagal menyimpan perbaikan klaim kesehatan:", err)
    return { error: "Perbaikan klaim gagal disimpan. Coba lagi." }
  }
  // File bukti yang dibuang baru dihapus dari disk setelah database tersimpan.
  await Promise.all(removed.map((d) => deleteClaimFile(d.storedFileName)))

  await logActivity({
    userId: Number(user.id),
    username: user.username,
    action: "UPDATE",
    entityType: "HealthClaim",
    description: `${user.username} memperbaiki klaim kesehatan ${claim.claimNumber} (sekarang ${formatRupiah(requestedAmount)}).`,
  })
  await createNotificationForUsers(await getStaffUserIds("PETUGAS"), {
    title: "Klaim kesehatan diperbaiki",
    message: `${employee.fullName} memperbaiki klaim ${claim.claimNumber} sebesar ${formatRupiah(requestedAmount)}. Klaim siap diperiksa ulang.`,
    link: `/pegawai/pemeriksaan-klaim/${claim.publicId}`,
  })

  revalidatePath("/pegawai/klaim-kesehatan")
  revalidatePath(`/pegawai/klaim-kesehatan/${claim.publicId}`)
  revalidatePath("/admin/payroll/klaim-kesehatan")
  revalidatePath("/pegawai/pemeriksaan-klaim")
  revalidatePath(`/admin/payroll/klaim-kesehatan/${claim.publicId}`)
  return { success: `Perbaikan klaim ${claim.claimNumber} terkirim dan menunggu konfirmasi ulang.`, publicId: claim.publicId }
}
