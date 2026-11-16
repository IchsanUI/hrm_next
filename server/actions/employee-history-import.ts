"use server"

import { revalidatePath } from "next/cache"

import { auth } from "@/auth"
import { logActivity } from "@/lib/activity-log"
import { importHistoryWorkbook, type HistoryImportResult } from "@/lib/employee-history-import"

const MAX_FILE_BYTES = 10 * 1024 * 1024

export type HistoryImportState = { error: string } | (HistoryImportResult & { error?: undefined }) | undefined

export async function importEmployeeHistoryAction(formData: FormData): Promise<HistoryImportState> {
  const session = await auth()
  const role = session?.user.role
  const allowed =
    role === "SUPER_ADMIN" ||
    (role === "HR_ADMIN" && session?.user.menuAccess.includes("kepegawaian.pegawai"))
  if (!session?.user || !allowed) {
    return { error: "Anda tidak punya akses untuk mengimpor data pegawai." }
  }

  const file = formData.get("file")
  if (!(file instanceof File) || file.size === 0) return { error: "Pilih file Excel terlebih dahulu." }
  if (file.size > MAX_FILE_BYTES) return { error: "File terlalu besar (maks. 10 MB)." }

  const result = await importHistoryWorkbook(await file.arrayBuffer())
  if ("error" in result) return { error: result.error }

  const inserted = result.summaries.reduce((s, x) => s + x.inserted, 0)
  const parts = result.summaries.filter((s) => s.inserted > 0).map((s) => `${s.label} ${s.inserted}`)
  await logActivity({
    userId: Number(session.user.id),
    username: session.user.username,
    action: "CREATE",
    entityType: "EmployeeHistoryImport",
    description: `${session.user.username} mengimpor ${inserted} data riwayat pegawai dari Excel${parts.length ? ` (${parts.join(", ")})` : ""}${result.totalErrors ? `, ${result.totalErrors} baris gagal` : ""}.`,
  })

  revalidatePath("/admin/pegawai", "layout")
  return result
}
