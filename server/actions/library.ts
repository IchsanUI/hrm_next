"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity-log"
import { createNotificationForUsers } from "@/lib/notifications"
import { deleteLibraryFile, readLibraryUpload, writeLibraryPdf } from "@/lib/library-storage"
import { LIBRARY_CATEGORIES, LIBRARY_CATEGORY_LABEL } from "@/lib/library-labels"
import {
  analyzePdfText,
  buildPdfCheck,
  classifyScanPages,
  describePdfError,
  extractDocumentTextFromFile,
  getLibrarySettings,
  invalidateLibrarySettingsCache,
  isOcrEngineAvailable,
  storeDocumentText,
  type PdfTextAnalysis,
} from "@/lib/library-text"
import { LIBRARY_SETTINGS_LIMITS, type LibraryPdfCheck } from "@/lib/library-text-labels"
import { kickLibraryWorker } from "@/lib/library-text-scheduler"

export type LibraryFormState = { error?: string; success?: boolean } | undefined

const metaSchema = z.object({
  title: z.string().trim().min(3, "Judul minimal 3 karakter.").max(500, "Judul maksimal 500 karakter."),
  documentNumber: z.string().trim().max(120, "Nomor dokumen maksimal 120 karakter.").optional(),
  category: z.enum(LIBRARY_CATEGORIES as [string, ...string[]], { message: "Pilih kategori dokumen." }),
  description: z.string().trim().max(2000, "Keterangan maksimal 2000 karakter.").optional(),
  effectiveDate: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v), "Format tanggal berlaku tidak valid."),
})

const MAX_PART_NUMBER = 50

async function requireLibraryManager() {
  const session = await auth()
  const user = session?.user
  if (!user) return null
  const allowed =
    user.role === "SUPER_ADMIN" ||
    (user.role === "HR_ADMIN" && user.menuAccess.includes("perpustakaan.kelola"))
  return allowed ? user : null
}

function parseMeta(formData: FormData) {
  const parsed = metaSchema.safeParse({
    title: formData.get("title") ?? "",
    documentNumber: formData.get("documentNumber") ?? undefined,
    category: formData.get("category") ?? "",
    description: formData.get("description") ?? undefined,
    effectiveDate: formData.get("effectiveDate") ?? undefined,
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Periksa kembali data yang diisi." } as const
  }
  const d = parsed.data
  return {
    data: {
      title: d.title,
      documentNumber: d.documentNumber || null,
      category: d.category as (typeof LIBRARY_CATEGORIES)[number],
      description: d.description || null,
      effectiveDate: d.effectiveDate ? new Date(`${d.effectiveDate}T00:00:00Z`) : null,
    },
  } as const
}

function revalidateLibrary() {
  revalidatePath("/admin/perpustakaan")
  revalidatePath("/pegawai/perpustakaan", "layout")
}

async function notifyEmployees(publicId: string, title: string, categoryLabel: string) {
  const users = await prisma.user.findMany({
    where: { isActive: true, employee: { isActive: true, isDeleted: false } },
    select: { id: true },
  })
  await createNotificationForUsers(
    users.map((u) => u.id),
    {
      title: "Dokumen baru di Perpustakaan",
      message: `${categoryLabel}: ${title}`,
      link: `/pegawai/perpustakaan/${publicId}`,
    }
  )
}

// Baca & periksa PDF yang diunggah: format, teks per halaman, dan batas
// halaman dari Pengaturan Perpustakaan.
async function inspectUpload(file: FormDataEntryValue | null) {
  const upload = await readLibraryUpload(file)
  if ("error" in upload) return { error: upload.error } as const
  let analysis: PdfTextAnalysis
  try {
    analysis = await analyzePdfText(upload.buffer)
  } catch (error) {
    return { error: describePdfError(error) } as const
  }
  const check = buildPdfCheck(analysis, await getLibrarySettings(), isOcrEngineAvailable())
  return { upload, analysis, check } as const
}

// Dipanggil form unggah begitu file dipilih — menampilkan jumlah halaman,
// halaman scan, status toggle OCR, atau alasan penolakan sebelum disimpan.
export async function checkLibraryPdfAction(formData: FormData): Promise<{ error: string } | { check: LibraryPdfCheck }> {
  const user = await requireLibraryManager()
  if (!user) return { error: "Anda tidak punya akses mengelola Perpustakaan." }
  const result = await inspectUpload(formData.get("file"))
  if ("error" in result) return { error: result.error ?? "File tidak dapat diperiksa." }
  return { check: result.check }
}

// Dokumen bagian: induknya harus dokumen utama (bukan bagian lain).
async function resolveParent(formData: FormData, selfId?: number) {
  const parentPublicId = String(formData.get("partOf") ?? "").trim()
  if (!parentPublicId) return { parent: null } as const
  const partNumber = Number(formData.get("partNumber"))
  if (!Number.isInteger(partNumber) || partNumber < 2 || partNumber > MAX_PART_NUMBER) {
    return { error: `Nomor bagian harus 2–${MAX_PART_NUMBER}.` } as const
  }
  const parent = await prisma.libraryDocument.findUnique({ where: { publicId: parentPublicId } })
  if (!parent || parent.partOfId !== null || parent.id === selfId) {
    return { error: "Dokumen induk (Bagian 1) tidak valid." } as const
  }
  const taken = await prisma.libraryDocument.findFirst({
    where: { partOfId: parent.id, partNumber, ...(selfId ? { NOT: { id: selfId } } : {}) },
    select: { id: true },
  })
  if (taken) return { error: `Bagian ${partNumber} untuk dokumen ini sudah ada.` } as const
  return { parent, partNumber } as const
}

export async function createLibraryDocumentAction(
  _prev: LibraryFormState,
  formData: FormData
): Promise<LibraryFormState> {
  const user = await requireLibraryManager()
  if (!user) return { error: "Anda tidak punya akses mengelola Perpustakaan." }

  const parentResult = await resolveParent(formData)
  if ("error" in parentResult) return { error: parentResult.error }
  const { parent } = parentResult

  // Bagian lanjutan mengikuti keterangan Bagian 1.
  const meta = parent
    ? ({
        data: {
          title: parent.title,
          documentNumber: parent.documentNumber,
          category: parent.category,
          description: String(formData.get("description") ?? "").trim().slice(0, 2000) || null,
          effectiveDate: parent.effectiveDate,
        },
      } as const)
    : parseMeta(formData)
  if ("error" in meta) return { error: meta.error }

  const inspected = await inspectUpload(formData.get("file"))
  if ("error" in inspected) return { error: inspected.error }
  const { upload, analysis, check } = inspected
  if (check.rejectReason) return { error: check.rejectReason }
  const ocrRequested = formData.get("ocr") === "on" && !check.ocrLockedReason

  const saved = await writeLibraryPdf(upload)
  const isPublished = parent ? parent.isPublished : formData.get("isPublished") === "on"
  let doc
  try {
    doc = await prisma.libraryDocument.create({
      data: {
        ...meta.data,
        ...saved,
        pageCount: analysis.totalPages,
        isPublished,
        uploadedBy: user.username,
        ocrRequested,
        partOfId: parent?.id ?? null,
        partNumber: parent ? parentResult.partNumber : null,
      },
    })
  } catch (err) {
    await deleteLibraryFile(saved.storedName)
    console.error("Gagal menyimpan dokumen perpustakaan:", err)
    return { error: "Dokumen gagal disimpan. Coba lagi." }
  }

  // Teks disimpan setelah dokumen ada. Kalau gagal, dokumen tetap tersimpan
  // (status MENUNGGU) dan dibaca ulang oleh lib/library-text-scheduler.ts.
  try {
    await storeDocumentText(doc.id, analysis, ocrRequested)
  } catch (err) {
    console.error("Gagal menyimpan teks dokumen perpustakaan:", err)
  }
  if (ocrRequested) kickLibraryWorker()

  const partLabel = parent ? ` Bagian ${parentResult.partNumber}` : ""
  await logActivity({
    userId: Number(user.id),
    username: user.username,
    action: "CREATE",
    entityType: "LibraryDocument",
    description: `${user.username} menambahkan dokumen Perpustakaan "${doc.title}"${partLabel} (${LIBRARY_CATEGORY_LABEL[doc.category]}${isPublished ? "" : ", draf"}; ${analysis.totalPages} hlm, ${check.scanPageCount} hlm scan${check.scanPageCount ? (ocrRequested ? ", dengan OCR" : ", tanpa OCR") : ""}).`,
  })

  if (!parent && isPublished && formData.get("notify") === "on") {
    await notifyEmployees(doc.publicId, doc.title, LIBRARY_CATEGORY_LABEL[doc.category])
  }

  revalidateLibrary()
  return { success: true }
}

export async function updateLibraryDocumentAction(
  publicId: string,
  _prev: LibraryFormState,
  formData: FormData
): Promise<LibraryFormState> {
  const user = await requireLibraryManager()
  if (!user) return { error: "Anda tidak punya akses mengelola Perpustakaan." }

  const existing = await prisma.libraryDocument.findUnique({ where: { publicId }, include: { partOf: true } })
  if (!existing) return { error: "Dokumen tidak ditemukan." }

  const parent = existing.partOf
  const meta = parent
    ? ({
        data: {
          title: parent.title,
          documentNumber: parent.documentNumber,
          category: parent.category,
          description: String(formData.get("description") ?? "").trim().slice(0, 2000) || null,
          effectiveDate: parent.effectiveDate,
        },
      } as const)
    : parseMeta(formData)
  if ("error" in meta) return { error: meta.error }

  // File pengganti opsional. Kalau ada, file lama baru dihapus SETELAH data
  // tersimpan, supaya dokumen tidak pernah kehilangan file.
  const file = formData.get("file")
  const hasNewFile = file instanceof File && file.size > 0
  const inspected = hasNewFile ? await inspectUpload(file) : null
  if (inspected && "error" in inspected) return { error: inspected.error }
  if (inspected?.check.rejectReason) return { error: inspected.check.rejectReason }
  const ocrRequested = inspected ? formData.get("ocr") === "on" && !inspected.check.ocrLockedReason : existing.ocrRequested
  const saved = inspected ? await writeLibraryPdf(inspected.upload) : null

  const isPublished = parent ? parent.isPublished : formData.get("isPublished") === "on"
  try {
    await prisma.$transaction(async (tx) => {
      await tx.libraryDocument.update({
        where: { id: existing.id },
        data: {
          ...meta.data,
          ...(saved ? { ...saved, pageCount: inspected!.analysis.totalPages, ocrRequested } : {}),
          isPublished,
        },
      })
      // Bagian lanjutan selalu mengikuti keterangan & status terbit Bagian 1.
      if (!parent) {
        await tx.libraryDocument.updateMany({
          where: { partOfId: existing.id },
          data: {
            title: meta.data.title,
            documentNumber: meta.data.documentNumber,
            category: meta.data.category,
            effectiveDate: meta.data.effectiveDate,
            isPublished,
          },
        })
      }
    })
  } catch (err) {
    if (saved) await deleteLibraryFile(saved.storedName)
    console.error("Gagal memperbarui dokumen perpustakaan:", err)
    return { error: "Perubahan gagal disimpan. Coba lagi." }
  }
  if (saved && inspected) {
    await deleteLibraryFile(existing.storedName)
    try {
      await storeDocumentText(existing.id, inspected.analysis, ocrRequested)
    } catch (err) {
      console.error("Gagal menyimpan teks dokumen perpustakaan:", err)
      await prisma.libraryDocument.update({ where: { id: existing.id }, data: { textStatus: "MENUNGGU", textExtractedAt: null } })
    }
    if (ocrRequested) kickLibraryWorker()
  }

  const changes = [
    saved ? "mengganti file" : null,
    existing.isPublished !== isPublished ? (isPublished ? "menerbitkan" : "menjadikan draf") : null,
  ].filter(Boolean)
  await logActivity({
    userId: Number(user.id),
    username: user.username,
    action: "UPDATE",
    entityType: "LibraryDocument",
    description: `${user.username} memperbarui dokumen Perpustakaan "${meta.data.title}"${parent ? ` Bagian ${existing.partNumber}` : ""}${changes.length ? ` (${changes.join(", ")})` : ""}.`,
  })

  if (!parent && isPublished && formData.get("notify") === "on") {
    await notifyEmployees(publicId, meta.data.title, LIBRARY_CATEGORY_LABEL[meta.data.category])
  }

  revalidateLibrary()
  return { success: true }
}

export async function deleteLibraryDocumentAction(publicId: string): Promise<{ error?: string }> {
  const user = await requireLibraryManager()
  if (!user) return { error: "Anda tidak punya akses mengelola Perpustakaan." }

  const existing = await prisma.libraryDocument.findUnique({
    where: { publicId },
    include: { parts: { select: { storedName: true } } },
  })
  if (!existing) return { error: "Dokumen tidak ditemukan." }

  // Bagian lanjutan ikut terhapus (onDelete: Cascade) — file-nya juga.
  await prisma.libraryDocument.delete({ where: { id: existing.id } })
  await deleteLibraryFile(existing.storedName)
  for (const part of existing.parts) await deleteLibraryFile(part.storedName)

  await logActivity({
    userId: Number(user.id),
    username: user.username,
    action: "DELETE",
    entityType: "LibraryDocument",
    description: `${user.username} menghapus dokumen Perpustakaan "${existing.title}"${existing.partNumber ? ` Bagian ${existing.partNumber}` : ""}${existing.parts.length ? ` beserta ${existing.parts.length} bagian lainnya` : ""}.`,
  })

  revalidateLibrary()
  return {}
}

// Tombol "Baca Ulang" — teks digital dibaca lagi dari file tersimpan.
export async function rereadLibraryTextAction(publicId: string): Promise<{ error?: string }> {
  const user = await requireLibraryManager()
  if (!user) return { error: "Anda tidak punya akses mengelola Perpustakaan." }
  const doc = await prisma.libraryDocument.findUnique({ where: { publicId }, select: { id: true, title: true } })
  if (!doc) return { error: "Dokumen tidak ditemukan." }

  const result = await extractDocumentTextFromFile(doc.id)
  kickLibraryWorker() // OCR yang diminta ikut diulang lewat antrean
  await logActivity({
    userId: Number(user.id),
    username: user.username,
    action: "UPDATE",
    entityType: "LibraryDocument",
    description: `${user.username} membaca ulang teks dokumen Perpustakaan "${doc.title}"${"error" in result ? ` (gagal: ${result.error})` : ""}.`,
  })
  revalidateLibrary()
  return "error" in result ? { error: result.error } : {}
}

// Tombol "Jalankan OCR" — untuk dokumen Tanpa OCR / Sebagian yang memenuhi
// batas. Masuk antrean langsung atau jadwal malam sesuai jumlah halaman scan.
export async function runLibraryOcrAction(publicId: string): Promise<{ error?: string; message?: string }> {
  const user = await requireLibraryManager()
  if (!user) return { error: "Anda tidak punya akses mengelola Perpustakaan." }
  const doc = await prisma.libraryDocument.findUnique({
    where: { publicId },
    select: { id: true, title: true, textStatus: true, textExtractedAt: true },
  })
  if (!doc) return { error: "Dokumen tidak ditemukan." }
  if (!doc.textExtractedAt) return { error: "Teks dokumen belum dibaca. Klik Baca Ulang terlebih dahulu." }
  if (doc.textStatus === "DIPROSES") return { error: "Dokumen ini sedang di-OCR." }

  const settings = await getLibrarySettings()
  if (!settings.ocrEnabled) return { error: "OCR sedang dinonaktifkan oleh Super Admin." }
  if (!isOcrEngineAvailable()) return { error: "Mesin OCR belum terpasang di server." }
  const pending = await prisma.libraryDocumentPage.count({ where: { documentId: doc.id, source: "NONE" } })
  if (pending === 0) return { error: "Tidak ada halaman scan yang perlu di-OCR." }
  const scanClass = classifyScanPages(pending, settings)
  if (scanClass === "too_large") {
    return { error: `Dokumen ini memiliki ${pending} halaman scan (batas OCR ${settings.ocrMaxScanPages}). Pecah file menjadi beberapa bagian.` }
  }

  const status = scanClass === "night" ? "DIJADWALKAN" : "MENUNGGU"
  await prisma.libraryDocument.update({
    where: { id: doc.id },
    data: { ocrRequested: true, textStatus: status, textError: null },
  })
  await logActivity({
    userId: Number(user.id),
    username: user.username,
    action: "UPDATE",
    entityType: "LibraryDocument",
    description: `${user.username} menjalankan OCR dokumen Perpustakaan "${doc.title}" (${pending} halaman scan${status === "DIJADWALKAN" ? ", dijadwalkan malam" : ""}).`,
  })
  kickLibraryWorker()
  revalidateLibrary()
  return {
    message:
      status === "DIJADWALKAN"
        ? `${pending} halaman scan dijadwalkan di-OCR pukul ${settings.nightStart}–${settings.nightEnd}.`
        : `${pending} halaman scan masuk antrean OCR.`,
  }
}

export type LibraryPageText = {
  page: number
  source: "TEXT_LAYER" | "OCR" | "NONE"
  text: string
  confidence: number | null
}

// Pratinjau teks per halaman untuk pengelola (dialog "Lihat Teks").
export async function getLibraryPagesAction(publicId: string): Promise<{ error: string } | { pages: LibraryPageText[] }> {
  const user = await requireLibraryManager()
  if (!user) return { error: "Anda tidak punya akses mengelola Perpustakaan." }
  const doc = await prisma.libraryDocument.findUnique({ where: { publicId }, select: { id: true } })
  if (!doc) return { error: "Dokumen tidak ditemukan." }
  const pages = await prisma.libraryDocumentPage.findMany({
    where: { documentId: doc.id },
    orderBy: { pageNumber: "asc" },
    select: { pageNumber: true, source: true, text: true, confidence: true },
  })
  return {
    pages: pages.map((p) => ({ page: p.pageNumber, source: p.source, text: p.text, confidence: p.confidence })),
  }
}

// ─── Pengaturan Perpustakaan (SUPER_ADMIN) ────────────────────────────────
const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Format jam harus HH:MM.")
const intIn = (label: string, [min, max]: readonly [number, number]) =>
  z.coerce.number().int(`${label} harus bilangan bulat.`).min(min, `${label} minimal ${min}.`).max(max, `${label} maksimal ${max}.`)

const settingsSchema = z
  .object({
    ocrEnabled: z.boolean(),
    ocrDirectMaxPages: intIn("Batas OCR langsung", LIBRARY_SETTINGS_LIMITS.ocrDirectMaxPages),
    ocrQueueMaxPages: intIn("Batas OCR antrean", LIBRARY_SETTINGS_LIMITS.ocrQueueMaxPages),
    ocrMaxScanPages: intIn("Batas halaman scan", LIBRARY_SETTINGS_LIMITS.ocrMaxScanPages),
    maxTotalPages: intIn("Batas total halaman", LIBRARY_SETTINGS_LIMITS.maxTotalPages),
    nightStart: timeSchema,
    nightEnd: timeSchema,
    ocrPageTimeoutSec: intIn("Batas waktu per halaman", LIBRARY_SETTINGS_LIMITS.ocrPageTimeoutSec),
  })
  .refine((v) => v.ocrQueueMaxPages >= v.ocrDirectMaxPages, "Batas OCR antrean tidak boleh lebih kecil dari batas OCR langsung.")
  .refine((v) => v.ocrMaxScanPages >= v.ocrQueueMaxPages, "Batas halaman scan tidak boleh lebih kecil dari batas OCR antrean.")
  .refine((v) => v.maxTotalPages >= v.ocrMaxScanPages, "Batas total halaman tidak boleh lebih kecil dari batas halaman scan.")
  .refine((v) => v.nightStart !== v.nightEnd, "Jam mulai dan selesai malam tidak boleh sama.")

export async function updateLibrarySettingsAction(formData: FormData): Promise<{ error?: string; success?: boolean }> {
  const session = await auth()
  if (session?.user.role !== "SUPER_ADMIN") return { error: "Hanya Super Admin yang dapat mengubah Pengaturan Perpustakaan." }

  const parsed = settingsSchema.safeParse({
    ocrEnabled: formData.get("ocrEnabled") === "on",
    ocrDirectMaxPages: formData.get("ocrDirectMaxPages"),
    ocrQueueMaxPages: formData.get("ocrQueueMaxPages"),
    ocrMaxScanPages: formData.get("ocrMaxScanPages"),
    maxTotalPages: formData.get("maxTotalPages"),
    nightStart: formData.get("nightStart"),
    nightEnd: formData.get("nightEnd"),
    ocrPageTimeoutSec: formData.get("ocrPageTimeoutSec"),
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Periksa kembali pengaturan." }

  const userId = Number(session.user.id)
  await prisma.librarySettings.upsert({
    where: { id: 1 },
    update: { ...parsed.data, updatedByUserId: userId },
    create: { id: 1, ...parsed.data, updatedByUserId: userId },
  })
  invalidateLibrarySettingsCache()

  const v = parsed.data
  await logActivity({
    userId,
    username: session.user.username,
    action: "UPDATE",
    entityType: "LibrarySettings",
    description: `${session.user.username} mengubah Pengaturan Perpustakaan: OCR ${v.ocrEnabled ? "aktif" : "nonaktif"}, langsung ≤${v.ocrDirectMaxPages} hlm, antrean ≤${v.ocrQueueMaxPages} hlm, maks. ${v.ocrMaxScanPages} hlm scan / ${v.maxTotalPages} hlm total, malam ${v.nightStart}–${v.nightEnd}, batas ${v.ocrPageTimeoutSec} dtk/hlm.`,
  })
  revalidatePath("/admin/perpustakaan")
  return { success: true }
}

export type LibraryReader = {
  name: string
  employeeNumber: string
  department: string | null
  readAt: string | null // ISO terakhir dibaca; null = belum membaca
  readCount: number
}

// Daftar sudah/belum membaca untuk satu dokumen — dimuat saat dialog dibuka
// (bukan di render halaman) supaya halaman daftar tetap ringan.
export async function getLibraryReadersAction(
  publicId: string
): Promise<{ error: string } | { readers: LibraryReader[] }> {
  const user = await requireLibraryManager()
  if (!user) return { error: "Anda tidak punya akses mengelola Perpustakaan." }

  const doc = await prisma.libraryDocument.findUnique({ where: { publicId }, select: { id: true } })
  if (!doc) return { error: "Dokumen tidak ditemukan." }

  const [employees, reads] = await Promise.all([
    prisma.employee.findMany({
      where: { isActive: true, isDeleted: false },
      select: { id: true, fullName: true, employeeNumber: true, department: { select: { name: true } } },
      orderBy: { fullName: "asc" },
    }),
    prisma.libraryDocumentRead.findMany({ where: { documentId: doc.id } }),
  ])
  const readByEmployee = new Map(reads.map((r) => [r.employeeId, r]))

  return {
    readers: employees.map((e) => {
      const read = readByEmployee.get(e.id)
      return {
        name: e.fullName,
        employeeNumber: e.employeeNumber,
        department: e.department?.name ?? null,
        readAt: read ? read.lastReadAt.toISOString() : null,
        readCount: read?.readCount ?? 0,
      }
    }),
  }
}
