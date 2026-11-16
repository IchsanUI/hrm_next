"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity-log"
import { createNotificationForUsers } from "@/lib/notifications"
import { deleteLibraryFile, saveLibraryPdf } from "@/lib/library-storage"
import { LIBRARY_CATEGORIES, LIBRARY_CATEGORY_LABEL } from "@/lib/library-labels"

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

export async function createLibraryDocumentAction(
  _prev: LibraryFormState,
  formData: FormData
): Promise<LibraryFormState> {
  const user = await requireLibraryManager()
  if (!user) return { error: "Anda tidak punya akses mengelola Perpustakaan." }

  const meta = parseMeta(formData)
  if ("error" in meta) return { error: meta.error }

  const saved = await saveLibraryPdf(formData.get("file"))
  if ("error" in saved) return { error: saved.error }

  const isPublished = formData.get("isPublished") === "on"
  let doc
  try {
    doc = await prisma.libraryDocument.create({
      data: { ...meta.data, ...saved, isPublished, uploadedBy: user.username },
    })
  } catch (err) {
    await deleteLibraryFile(saved.storedName)
    console.error("Gagal menyimpan dokumen perpustakaan:", err)
    return { error: "Dokumen gagal disimpan. Coba lagi." }
  }

  await logActivity({
    userId: Number(user.id),
    username: user.username,
    action: "CREATE",
    entityType: "LibraryDocument",
    description: `${user.username} menambahkan dokumen Perpustakaan "${doc.title}" (${LIBRARY_CATEGORY_LABEL[doc.category]}${isPublished ? "" : ", draf"}).`,
  })

  if (isPublished && formData.get("notify") === "on") {
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

  const existing = await prisma.libraryDocument.findUnique({ where: { publicId } })
  if (!existing) return { error: "Dokumen tidak ditemukan." }

  const meta = parseMeta(formData)
  if ("error" in meta) return { error: meta.error }

  // File pengganti opsional. Kalau ada, file lama baru dihapus SETELAH data
  // tersimpan, supaya dokumen tidak pernah kehilangan file.
  const file = formData.get("file")
  const hasNewFile = file instanceof File && file.size > 0
  const saved = hasNewFile ? await saveLibraryPdf(file) : null
  if (saved && "error" in saved) return { error: saved.error }

  const isPublished = formData.get("isPublished") === "on"
  try {
    await prisma.libraryDocument.update({
      where: { id: existing.id },
      data: { ...meta.data, ...(saved ?? {}), isPublished },
    })
  } catch (err) {
    if (saved) await deleteLibraryFile(saved.storedName)
    console.error("Gagal memperbarui dokumen perpustakaan:", err)
    return { error: "Perubahan gagal disimpan. Coba lagi." }
  }
  if (saved) await deleteLibraryFile(existing.storedName)

  const changes = [
    saved ? "mengganti file" : null,
    existing.isPublished !== isPublished ? (isPublished ? "menerbitkan" : "menjadikan draf") : null,
  ].filter(Boolean)
  await logActivity({
    userId: Number(user.id),
    username: user.username,
    action: "UPDATE",
    entityType: "LibraryDocument",
    description: `${user.username} memperbarui dokumen Perpustakaan "${meta.data.title}"${changes.length ? ` (${changes.join(", ")})` : ""}.`,
  })

  if (isPublished && formData.get("notify") === "on") {
    await notifyEmployees(publicId, meta.data.title, LIBRARY_CATEGORY_LABEL[meta.data.category])
  }

  revalidateLibrary()
  return { success: true }
}

export async function deleteLibraryDocumentAction(publicId: string): Promise<{ error?: string }> {
  const user = await requireLibraryManager()
  if (!user) return { error: "Anda tidak punya akses mengelola Perpustakaan." }

  const existing = await prisma.libraryDocument.findUnique({ where: { publicId } })
  if (!existing) return { error: "Dokumen tidak ditemukan." }

  await prisma.libraryDocument.delete({ where: { id: existing.id } })
  await deleteLibraryFile(existing.storedName)

  await logActivity({
    userId: Number(user.id),
    username: user.username,
    action: "DELETE",
    entityType: "LibraryDocument",
    description: `${user.username} menghapus dokumen Perpustakaan "${existing.title}".`,
  })

  revalidateLibrary()
  return {}
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
