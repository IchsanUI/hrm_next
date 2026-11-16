"use server"

import { createHash } from "crypto"
import { readFile, unlink } from "fs/promises"
import { revalidatePath } from "next/cache"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity-log"
import { ARCHIVE_MONTH_OPTIONS, ARCHIVE_TARGET_INFO, isArchiveTarget } from "@/lib/archive/targets"
import { describeTarget, restoreArchive, runArchive, type RestoreResult } from "@/lib/archive/run-archive"

// Teks yang wajib diketik ulang di dialog konfirmasi sebelum data dihapus.
const CONFIRM_TEXT = "HAPUS"
const MAX_UPLOAD_BYTES = 11 * 1024 * 1024 // di bawah serverActions.bodySizeLimit (12mb)

async function requireSuperAdmin() {
  const session = await auth()
  if (session?.user.role !== "SUPER_ADMIN") return null
  return session
}

function revalidateArchivePaths() {
  revalidatePath("/admin/backup/arsip")
  revalidatePath("/admin/monitoring-system/penyimpanan")
}

function formatRestore(r: RestoreResult) {
  const parts = [`${r.inserted.toLocaleString("id-ID")} baris dikembalikan`]
  if (r.skippedExisting > 0) parts.push(`${r.skippedExisting.toLocaleString("id-ID")} sudah ada (dilewati)`)
  if (r.skippedOrphan > 0) parts.push(`${r.skippedOrphan.toLocaleString("id-ID")} milik akun yang sudah dihapus (dilewati)`)
  return parts.join(", ")
}

export type ArchiveActionState = { error?: string; message?: string } | undefined

export async function runArchiveAction(
  target: string,
  months: number,
  confirmText: string
): Promise<ArchiveActionState> {
  const session = await requireSuperAdmin()
  if (!session) return { error: "Hanya Super Admin yang dapat mengarsipkan data." }
  if (!isArchiveTarget(target)) return { error: "Jenis data tidak valid." }
  if (!(ARCHIVE_MONTH_OPTIONS as readonly number[]).includes(months)) return { error: "Batas waktu tidak valid." }
  if (confirmText.trim() !== CONFIRM_TEXT) return { error: `Ketik ${CONFIRM_TEXT} untuk mengonfirmasi.` }

  try {
    const result = await runArchive(target, months, session.user.username)
    await logActivity({
      userId: Number(session.user.id),
      username: session.user.username,
      action: "ARCHIVE",
      entityType: "DataArchive",
      description: `${session.user.username} mengarsipkan & menghapus ${result.rowCount.toLocaleString("id-ID")} baris ${ARCHIVE_TARGET_INFO[target].label} yang lebih lama dari ${months} bulan (arsip ${result.publicId}).`,
    })
    revalidateArchivePaths()
    return {
      message:
        `${result.rowCount.toLocaleString("id-ID")} baris diarsipkan & dihapus dari database.` +
        (result.remaining > 0 ? ` Masih ada ${result.remaining.toLocaleString("id-ID")} baris — jalankan lagi untuk melanjutkan.` : ""),
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Gagal mengarsipkan data." }
  }
}

export async function deleteArchiveFileAction(publicId: string): Promise<ArchiveActionState> {
  const session = await requireSuperAdmin()
  if (!session) return { error: "Hanya Super Admin yang dapat menghapus file arsip." }

  const archive = await prisma.dataArchive.findUnique({ where: { publicId } })
  if (!archive?.filePath) return { error: "File arsip tidak ada di server." }

  await unlink(archive.filePath).catch(() => {})
  await prisma.dataArchive.update({
    where: { id: archive.id },
    data: { filePath: null, fileDeletedAt: new Date() },
  })
  await logActivity({
    userId: Number(session.user.id),
    username: session.user.username,
    action: "DELETE",
    entityType: "DataArchive",
    description: `${session.user.username} menghapus file arsip ${archive.fileName} dari server (${describeTarget(archive.target)}, ${archive.rowCount} baris).`,
  })
  revalidateArchivePaths()
  return { message: "File arsip dihapus dari server. Simpan salinan unduhan Anda untuk import ulang." }
}

async function markRestored(sha256: string, inserted: number) {
  await prisma.dataArchive.updateMany({
    where: { sha256 },
    data: { lastRestoredAt: new Date(), lastRestoredRows: inserted },
  })
}

export async function restoreStoredArchiveAction(publicId: string): Promise<ArchiveActionState> {
  const session = await requireSuperAdmin()
  if (!session) return { error: "Hanya Super Admin yang dapat meng-import arsip." }

  const archive = await prisma.dataArchive.findUnique({ where: { publicId } })
  if (!archive?.filePath) return { error: "File arsip tidak ada di server — gunakan Import dari File." }

  try {
    const buffer = await readFile(archive.filePath)
    if (createHash("sha256").update(buffer).digest("hex") !== archive.sha256) {
      return { error: "File arsip di server sudah berubah sejak dibuat (checksum tidak cocok). Import dibatalkan." }
    }
    const result = await restoreArchive(buffer)
    await markRestored(archive.sha256, result.inserted)
    await logActivity({
      userId: Number(session.user.id),
      username: session.user.username,
      action: "RESTORE",
      entityType: "DataArchive",
      description: `${session.user.username} meng-import ulang arsip ${archive.fileName}: ${formatRestore(result)}.`,
    })
    revalidateArchivePaths()
    return { message: `Import selesai: ${formatRestore(result)}.` }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Gagal meng-import arsip." }
  }
}

export async function restoreUploadedArchiveAction(formData: FormData): Promise<ArchiveActionState> {
  const session = await requireSuperAdmin()
  if (!session) return { error: "Hanya Super Admin yang dapat meng-import arsip." }

  const file = formData.get("file")
  if (!(file instanceof File) || file.size === 0) return { error: "Pilih file arsip (.jsonl.gz)." }
  if (file.size > MAX_UPLOAD_BYTES) return { error: "File terlalu besar (maks. 11 MB)." }

  try {
    const result = await restoreArchive(Buffer.from(await file.arrayBuffer()))
    await markRestored(result.sha256, result.inserted)
    await logActivity({
      userId: Number(session.user.id),
      username: session.user.username,
      action: "RESTORE",
      entityType: "DataArchive",
      description: `${session.user.username} meng-import arsip dari file "${file.name}" (${describeTarget(result.target)}): ${formatRestore(result)}.`,
    })
    revalidateArchivePaths()
    return { message: `Import selesai: ${formatRestore(result)}.` }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Gagal meng-import arsip." }
  }
}
