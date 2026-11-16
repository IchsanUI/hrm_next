import { redirect } from "next/navigation"
import { CheckCircle2, Clock, Inbox, XCircle } from "lucide-react"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { cn } from "@/lib/utils"
import { Breadcrumb } from "@/components/breadcrumb"
import { Card, CardContent } from "@/components/ui/card"
import { AutoRefresh } from "@/components/auto-refresh"
import { ISSUE_STATUS_TONE } from "@/components/issue-status-badge"
import { parseAttachmentUrls } from "@/lib/issue-report-attachments"
import { IssueReportTable, type IssueReportRow } from "@/components/issue-report-table"

export default async function LaporanKendalaPage() {
  const session = await auth()
  if (session?.user.role !== "SUPER_ADMIN") {
    redirect("/admin/dashboard")
  }

  const [reports, grouped] = await Promise.all([
    prisma.issueReport.findMany({
      orderBy: { createdAt: "desc" },
      take: 500,
      include: { employee: { select: { fullName: true, employeeNumber: true } } },
    }),
    prisma.issueReport.groupBy({ by: ["status"], _count: { _all: true } }),
  ])
  const countOf = (status: IssueReportRow["status"]) =>
    grouped.find((g) => g.status === status)?._count._all ?? 0

  const rows: IssueReportRow[] = reports.map((r) => ({
    publicId: r.publicId,
    ticketNumber: r.ticketNumber,
    employeeName: r.employee.fullName,
    employeeNumber: r.employee.employeeNumber,
    category: r.category,
    title: r.title,
    description: r.description,
    attachmentUrls: parseAttachmentUrls(r.attachmentUrls),
    status: r.status,
    adminNote: r.adminNote,
    handledBy: r.handledBy,
    createdAt: r.createdAt.toISOString(),
  }))

  const stats = [
    { status: "BARU", label: "Laporan Baru", hint: "Belum ditinjau", icon: Inbox },
    { status: "DIPROSES", label: "Sedang Diproses", hint: "Dalam penanganan", icon: Clock },
    { status: "SELESAI", label: "Selesai", hint: "Sudah ditangani", icon: CheckCircle2 },
    { status: "DITOLAK", label: "Ditolak", hint: "Tidak ditindaklanjuti", icon: XCircle },
  ] as const

  return (
    <div>
      <Breadcrumb
        items={[
          { label: "Dashboard", href: "/admin/dashboard" },
          { label: "Monitoring System" },
          { label: "Laporan Kendala" },
        ]}
      />
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Laporan Kendala</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pantau dan tindak lanjuti tiket kendala sistem yang dikirim pegawai.
          </p>
        </div>
        <AutoRefresh intervalSeconds={30} />
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <Card key={stat.status}>
              <CardContent className="flex items-center gap-3">
                <span
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-lg",
                    ISSUE_STATUS_TONE[stat.status].icon
                  )}
                >
                  <Icon className="size-5" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-xs text-muted-foreground">{stat.label}</p>
                  <p className="text-2xl leading-tight font-semibold tabular-nums">
                    {countOf(stat.status)}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{stat.hint}</p>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <IssueReportTable reports={rows} />
    </div>
  )
}
