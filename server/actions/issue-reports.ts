"use server"

import { randomBytes } from "crypto"
import { revalidatePath } from "next/cache"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity-log"
import { createNotification } from "@/lib/notifications"
import { saveIssueReportImages } from "@/lib/issue-report-attachments"
import { ISSUE_STATUS_LABEL, buildTicketNumber } from "@/lib/issue-report-labels"
import { issueReportSchema, issueReportUpdateSchema } from "@/lib/validations/issue-report"

export type IssueReportState =
  | { error?: string; success?: boolean; ticketNumber?: string }
  | undefined

// Batas laporan berstatus BARU per pegawai — mencegah spam laporan sebelum
// laporan sebelumnya sempat ditinjau.
const MAX_OPEN_NEW_REPORTS = 5

export async function createIssueReportAction(
  _prevState: IssueReportState,
  formData: FormData
): Promise<IssueReportState> {
  const session = await auth()
  const employeeId = session?.user.employeeId
  if (!session?.user || !employeeId) {
    return { error: "Akun Anda tidak terhubung ke data pegawai." }
  }

  const parsed = issueReportSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Periksa kembali data yang diisi." }
  }

  const openCount = await prisma.issueReport.count({
    where: { employeeId, status: "BARU" },
  })
  if (openCount >= MAX_OPEN_NEW_REPORTS) {
    return {
      error: `Anda masih punya ${openCount} laporan yang belum ditinjau. Tunggu ditindaklanjuti dulu sebelum mengirim yang baru.`,
    }
  }

  const saved = await saveIssueReportImages(formData.getAll("images"), employeeId)
  if ("error" in saved) return { error: saved.error }

  // Nomor tiket butuh id hasil insert — isi nilai sementara yang unik dulu,
  // lalu langsung diganti nomor final dalam transaksi yang sama.
  const report = await prisma.$transaction(async (tx) => {
    const created = await tx.issueReport.create({
      data: {
        employeeId,
        ...parsed.data,
        attachmentUrls: saved.urls,
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
    description: `${session.user.username} mengirim laporan kendala ${report.ticketNumber} "${report.title}".`,
  })

  const superAdmins = await prisma.user.findMany({
    where: { role: { name: "SUPER_ADMIN" }, isActive: true },
    select: { id: true },
  })
  await Promise.all(
    superAdmins.map((u) =>
      createNotification({
        userId: u.id,
        title: "Laporan Kendala Baru",
        message: `${report.ticketNumber} — ${report.employee.fullName}: ${report.title}`,
        link: "/admin/monitoring-system/laporan-kendala",
      })
    )
  )

  revalidatePath("/pegawai/laporkan-kendala")
  revalidatePath("/admin/monitoring-system/laporan-kendala")
  return { success: true, ticketNumber: report.ticketNumber }
}

export async function updateIssueReportAction(
  publicId: string,
  input: { status: string; adminNote?: string }
): Promise<IssueReportState> {
  const session = await auth()
  if (session?.user.role !== "SUPER_ADMIN") {
    return { error: "Hanya Super Admin yang dapat menindaklanjuti laporan." }
  }

  const parsed = issueReportUpdateSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Periksa kembali data yang diisi." }
  }

  const existing = await prisma.issueReport.findUnique({
    where: { publicId },
    include: { employee: { select: { id: true, fullName: true } } },
  })
  if (!existing) return { error: "Laporan tidak ditemukan." }

  const { status, adminNote } = parsed.data
  const isFinal = status === "SELESAI" || status === "DITOLAK"
  await prisma.issueReport.update({
    where: { id: existing.id },
    data: {
      status,
      adminNote: adminNote || null,
      handledBy: session.user.username,
      resolvedAt: isFinal ? new Date() : null,
    },
  })

  await logActivity({
    userId: Number(session.user.id),
    username: session.user.username,
    action: "UPDATE",
    entityType: "IssueReport",
    description: `${session.user.username} mengubah status laporan kendala ${existing.ticketNumber} "${existing.title}" (${existing.employee.fullName}) menjadi ${ISSUE_STATUS_LABEL[status]}.`,
  })

  if (status !== existing.status) {
    const reporter = await prisma.user.findUnique({
      where: { employeeId: existing.employee.id },
      select: { id: true },
    })
    if (reporter) {
      await createNotification({
        userId: reporter.id,
        title: "Laporan Kendala Diperbarui",
        message: `Laporan ${existing.ticketNumber} "${existing.title}" kini berstatus ${ISSUE_STATUS_LABEL[status]}.`,
        link: "/pegawai/laporkan-kendala",
      })
    }
  }

  revalidatePath("/pegawai/laporkan-kendala")
  revalidatePath("/admin/monitoring-system/laporan-kendala")
  return { success: true }
}
