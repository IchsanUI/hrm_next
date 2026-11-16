import { redirect } from "next/navigation"
import { Inbox, MessageSquareWarning, MessageSquareReply } from "lucide-react"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { Breadcrumb } from "@/components/breadcrumb"
import { Card } from "@/components/ui/card"
import { IssueReportForm } from "@/components/issue-report-form"
import { IssueReportImages } from "@/components/issue-report-images"
import { IssueStatusBadge, TicketNumber } from "@/components/issue-status-badge"
import { parseAttachmentUrls } from "@/lib/issue-report-attachments"
import { ISSUE_CATEGORY_LABEL } from "@/lib/issue-report-labels"

function formatDateTime(date: Date) {
  return date.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export default async function LaporkanKendalaPage() {
  const session = await auth()
  const employeeId = session?.user.employeeId
  if (!employeeId) {
    redirect("/pegawai/dashboard")
  }

  const reports = await prisma.issueReport.findMany({
    where: { employeeId },
    orderBy: { createdAt: "desc" },
    take: 50,
  })
  const openCount = reports.filter((r) => r.status === "BARU" || r.status === "DIPROSES").length

  return (
    <div>
      <Breadcrumb
        items={[
          { label: "Dashboard", href: "/pegawai/dashboard" },
          { label: "Laporkan Kendala" },
        ]}
      />
      <div className="mb-6 flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <MessageSquareWarning className="size-5" />
        </span>
        <div>
          <h1 className="text-xl font-semibold sm:text-2xl">Laporkan Kendala</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Sampaikan masalah yang Anda alami saat memakai sistem HRIS.
          </p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] xl:items-start">
        <IssueReportForm />

        <Card className="gap-0 py-0">
          <div className="flex items-center justify-between gap-3 border-b px-4 py-3.5">
            <div>
              <h2 className="text-base font-semibold">Riwayat Laporan Saya</h2>
              <p className="text-xs text-muted-foreground">
                {reports.length === 0
                  ? "Belum ada laporan"
                  : `${reports.length} laporan · ${openCount} masih ditangani`}
              </p>
            </div>
          </div>

          {reports.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
              <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Inbox className="size-5" />
              </span>
              <p className="text-sm font-medium">Belum ada laporan</p>
              <p className="max-w-xs text-xs text-muted-foreground">
                Laporan yang Anda kirim beserta status dan tanggapannya akan muncul di sini.
              </p>
            </div>
          ) : (
            <ul className="divide-y xl:max-h-[calc(100vh-16rem)] xl:overflow-y-auto">
              {reports.map((report) => (
                <li key={report.id} className="grid gap-2 px-4 py-4">
                  <div className="flex items-center justify-between gap-2">
                    <TicketNumber value={report.ticketNumber} />
                    <IssueStatusBadge status={report.status} />
                  </div>
                  <div>
                    <p className="line-clamp-2 break-words text-sm font-medium">{report.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {ISSUE_CATEGORY_LABEL[report.category]} · {formatDateTime(report.createdAt)}
                    </p>
                  </div>
                  <p className="line-clamp-3 whitespace-pre-wrap break-words text-sm text-muted-foreground">
                    {report.description}
                  </p>
                  <IssueReportImages urls={parseAttachmentUrls(report.attachmentUrls)} size="sm" />
                  {report.adminNote ? (
                    <div className="mt-1 rounded-md border-l-2 border-primary bg-muted/60 px-3 py-2">
                      <p className="mb-0.5 flex items-center gap-1.5 text-xs font-medium">
                        <MessageSquareReply className="size-3.5" />
                        Tanggapan Admin
                      </p>
                      <p className="whitespace-pre-wrap break-words text-sm">{report.adminNote}</p>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}
