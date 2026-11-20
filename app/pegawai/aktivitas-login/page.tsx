import { headers } from "next/headers"
import Link from "next/link"
import { redirect } from "next/navigation"
import { History, LogIn, MessageSquareWarning, ShieldAlert, ShieldCheck } from "lucide-react"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { Breadcrumb } from "@/components/breadcrumb"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { LoginActivityList, type LoginActivityItem } from "@/components/login-activity-list"
import { LOGIN_ACTIVITY_ACTIONS, LOGIN_REPORT_REF, formatLoginTime } from "@/lib/login-activity"
import { formatRelativeTime } from "@/lib/relative-time"
import { describeDevice } from "@/lib/user-agent"

const HISTORY_DAYS = 90
const FAILED_WINDOW_DAYS = 30

function daysAgo(days: number) {
  return new Date(Date.now() - days * 86_400_000)
}

// Aktivitas Login — mirip "Perangkat Tertaut" WhatsApp: pegawai bisa melihat
// kapan & dari perangkat apa akunnya dipakai login, lalu melaporkan
// aktivitas yang bukan dirinya ke Super Admin (lihat
// server/actions/login-activity.ts).
export default async function AktivitasLoginPage() {
  const session = await auth()
  const employeeId = session?.user.employeeId
  if (!session?.user || !employeeId) {
    redirect("/pegawai/dashboard")
  }
  const userId = Number(session.user.id)

  const since = daysAgo(HISTORY_DAYS)
  const failedSince = daysAgo(FAILED_WINDOW_DAYS)
  const [logs, failedCount, reports, requestHeaders] = await Promise.all([
    prisma.activityLog.findMany({
      where: { userId, action: { in: [...LOGIN_ACTIVITY_ACTIONS] }, createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: { id: true, action: true, ipAddress: true, userAgent: true, createdAt: true },
    }),
    prisma.activityLog.count({ where: { userId, action: "LOGIN_FAILED", createdAt: { gte: failedSince } } }),
    prisma.issueReport.findMany({
      where: { employeeId, description: { contains: LOGIN_REPORT_REF } },
      select: { ticketNumber: true, description: true },
    }),
    headers(),
  ])

  // id log → nomor tiket yang sudah melaporkannya.
  const reportedByLogId = new Map<number, string>()
  for (const r of reports) {
    for (const m of r.description.matchAll(/\[ref-log:(\d+)\]/g)) reportedByLogId.set(Number(m[1]), r.ticketNumber)
  }

  // "Perangkat ini" = login TERBARU dengan user-agent sama persis dengan
  // browser yang sedang membuka halaman ini.
  const currentUa = requestHeaders.get("user-agent")
  const currentLoginId = logs.find((l) => l.action === "LOGIN" && l.userAgent && l.userAgent === currentUa)?.id

  const items: LoginActivityItem[] = logs.map((l) => {
    const device = describeDevice(l.userAgent)
    return {
      id: l.id,
      action: l.action as LoginActivityItem["action"],
      deviceLabel: device.label,
      deviceKind: device.kind,
      ipAddress: l.ipAddress,
      timeLabel: formatLoginTime(l.createdAt),
      relativeLabel: formatRelativeTime(l.createdAt),
      isCurrentDevice: l.id === currentLoginId,
      reportedTicket: reportedByLogId.get(l.id) ?? null,
    }
  })

  const logins = logs.filter((l) => l.action === "LOGIN")
  // Login sebelum sesi ini — info paling berguna untuk mendeteksi orang lain
  // ("terakhir saya login kemarin, kok ada login tadi malam?").
  const previousLogin = logins.find((l) => l.id !== currentLoginId) ?? null
  const previousDevice = previousLogin ? describeDevice(previousLogin.userAgent) : null

  return (
    <div>
      <Breadcrumb items={[{ label: "Dashboard", href: "/pegawai/dashboard" }, { label: "Aktivitas Login" }]} />
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <History className="size-5" />
          </span>
          <div>
            <h1 className="text-xl font-semibold sm:text-2xl">Aktivitas Login</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Kapan dan dari perangkat apa akun Anda dipakai masuk, {HISTORY_DAYS} hari terakhir.
            </p>
          </div>
        </div>
        <Button variant="outline" nativeButton={false} render={<Link href="/pegawai/laporkan-kendala" />}>
          <MessageSquareWarning />
          Laporkan Kendala
        </Button>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-2">
        <Card className="flex flex-row items-start gap-3 p-4">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <LogIn className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">Login sebelumnya</p>
            {previousLogin && previousDevice ? (
              <>
                <p className="mt-0.5 text-sm font-semibold">{formatLoginTime(previousLogin.createdAt)}</p>
                <p className="text-xs text-muted-foreground">
                  {previousDevice.label}
                  {previousLogin.ipAddress ? ` · IP ${previousLogin.ipAddress}` : ""}
                </p>
              </>
            ) : (
              <p className="mt-0.5 text-sm">Belum ada login lain tercatat.</p>
            )}
          </div>
        </Card>

        <Card className="flex flex-row items-start gap-3 p-4">
          {failedCount > 0 ? (
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400">
              <ShieldAlert className="size-4" />
            </span>
          ) : (
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400">
              <ShieldCheck className="size-4" />
            </span>
          )}
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">Percobaan login gagal ({FAILED_WINDOW_DAYS} hari)</p>
            <p className="mt-0.5 text-sm font-semibold">{failedCount > 0 ? `${failedCount} kali` : "Tidak ada"}</p>
            <p className="text-xs text-muted-foreground">
              {failedCount > 0
                ? "Kalau bukan Anda yang salah memasukkan password, laporkan dan segera ganti password."
                : "Akun Anda aman dari percobaan login yang gagal."}
            </p>
          </div>
        </Card>
      </div>

      <Card className="gap-0 overflow-hidden p-0">
        <div className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold">Riwayat</h2>
          <p className="text-xs text-muted-foreground">
            Tidak mengenali sebuah aktivitas? Tekan <span className="font-medium">Ini bukan saya</span> untuk melaporkannya ke
            Super Admin.
          </p>
        </div>
        <LoginActivityList items={items} canReport passwordHref="/pegawai/pengaturan" />
      </Card>
    </div>
  )
}
