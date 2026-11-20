"use server"

import { randomBytes } from "crypto"
import { revalidatePath } from "next/cache"
import { z } from "zod"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity-log"
import { createNotification } from "@/lib/notifications"
import { buildTicketNumber } from "@/lib/issue-report-labels"
import { LOGIN_REPORT_REF, REPORTABLE_LOGIN_ACTIONS, formatLoginTime } from "@/lib/login-activity"
import { describeDevice } from "@/lib/user-agent"

export type ReportLoginState = { error?: string; ticketNumber?: string } | undefined

const schema = z.object({
  logId: z.coerce.number().int().positive(),
  note: z.string().trim().max(1000, "Keterangan maksimal 1000 karakter").optional(),
})

// "Ini bukan saya" dari halaman Aktivitas Login — membuat tiket Laporan
// Kendala kategori AKUN berisi detail login yang dicurigai (waktu, perangkat,
// IP), lalu memberi tahu SUPER_ADMIN (penindak Laporan Kendala) untuk
// ditindaklanjuti (reset password, nonaktifkan akun, cek IP, dst).
export async function reportSuspiciousLoginAction(
  _prev: ReportLoginState,
  formData: FormData
): Promise<ReportLoginState> {
  const session = await auth()
  const employeeId = session?.user.employeeId
  if (!session?.user || !employeeId) {
    return { error: "Akun Anda tidak terhubung ke data pegawai." }
  }

  const parsed = schema.safeParse({
    logId: formData.get("logId"),
    note: formData.get("note") || undefined,
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Data tidak valid." }
  }
  const { logId, note } = parsed.data

  // Hanya log milik akun ini sendiri yang boleh dilaporkan.
  const log = await prisma.activityLog.findFirst({
    where: { id: logId, userId: Number(session.user.id), action: { in: [...REPORTABLE_LOGIN_ACTIONS] } },
  })
  if (!log) {
    return { error: "Aktivitas login tidak ditemukan." }
  }

  const refTag = `${LOGIN_REPORT_REF}${log.id}]`
  const existing = await prisma.issueReport.findFirst({
    where: { employeeId, description: { contains: refTag } },
    select: { ticketNumber: true },
  })
  if (existing) {
    return { error: `Aktivitas ini sudah dilaporkan (tiket ${existing.ticketNumber}).` }
  }

  const device = describeDevice(log.userAgent)
  const failed = log.action === "LOGIN_FAILED"
  const when = formatLoginTime(log.createdAt)
  const title = `Ini bukan saya — ${failed ? "percobaan login gagal" : "login"} ${when}`
  const description = [
    `Pegawai melaporkan aktivitas ${failed ? "percobaan login gagal" : "login"} yang TIDAK dilakukannya.`,
    "",
    `Waktu     : ${when} WIB`,
    `Perangkat : ${device.label}`,
    `Alamat IP : ${log.ipAddress ?? "-"}`,
    `Username  : ${log.username}`,
    note ? `\nKeterangan pegawai:\n${note}` : null,
    "",
    "Saran tindak lanjut: reset password akun, periksa log aktivitas dari IP tersebut, nonaktifkan akun sementara bila perlu.",
    refTag,
  ]
    .filter((line) => line !== null)
    .join("\n")

  const report = await prisma.$transaction(async (tx) => {
    const created = await tx.issueReport.create({
      data: {
        employeeId,
        category: "AKUN",
        title: title.slice(0, 150),
        description,
        ticketNumber: `TMP-${randomBytes(8).toString("hex")}`,
      },
    })
    return tx.issueReport.update({
      where: { id: created.id },
      data: { ticketNumber: buildTicketNumber(created.id, created.createdAt) },
      include: { employee: { select: { fullName: true } } },
    })
  })

  await logActivity({
    userId: Number(session.user.id),
    username: session.user.username,
    action: "CREATE",
    entityType: "IssueReport",
    description: `${session.user.username} melaporkan aktivitas login mencurigakan (${report.ticketNumber}).`,
  })

  const superAdmins = await prisma.user.findMany({
    where: { role: { name: "SUPER_ADMIN" }, isActive: true },
    select: { id: true },
  })
  await Promise.all(
    superAdmins.map((u) =>
      createNotification({
        userId: u.id,
        title: "⚠ Laporan Login Mencurigakan",
        message: `${report.ticketNumber} — ${report.employee.fullName}: login ${when} dari ${device.label} (IP ${log.ipAddress ?? "-"}) bukan dirinya.`,
        link: "/admin/monitoring-system/laporan-kendala",
      })
    )
  )

  revalidatePath("/pegawai/aktivitas-login")
  revalidatePath("/pegawai/laporkan-kendala")
  revalidatePath("/admin/monitoring-system/laporan-kendala")
  return { ticketNumber: report.ticketNumber }
}
