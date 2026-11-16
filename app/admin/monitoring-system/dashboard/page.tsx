import Link from "next/link"
import { redirect } from "next/navigation"
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Database,
  KeyRound,
  Lock,
  LogIn,
  Network,
  ShieldAlert,
  ShieldCheck,
  ScanSearch,
  Users,
  XCircle,
} from "lucide-react"

import { auth } from "@/auth"
import { cn } from "@/lib/utils"
import { getAccessOverview, getDatabaseHealth, getRequestActivity } from "@/lib/system-monitoring"
import { Breadcrumb } from "@/components/breadcrumb"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AutoRefresh } from "@/components/auto-refresh"
import { HourlyActivityChart } from "@/components/hourly-activity-chart"
import { MalwareScanPanel } from "@/components/malware-scan-panel"

const ROLE_LABEL = { SUPER_ADMIN: "Super Admin", HR_ADMIN: "HR Admin", EMPLOYEE: "Pegawai" } as const

function formatBytes(bytes: number) {
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`
}

function formatUptime(seconds: number) {
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return d > 0 ? `${d} hari ${h} jam` : h > 0 ? `${h} jam ${m} mnt` : `${m} menit`
}

function formatDateTime(date: Date) {
  return date.toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
}

type Tone = "good" | "warning" | "critical"
const TONE_CLASS: Record<Tone, string> = {
  good: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  warning: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  critical: "bg-rose-500/15 text-rose-700 dark:text-rose-400",
}
const TONE_ICON = { good: CheckCircle2, warning: AlertTriangle, critical: XCircle }

function StatusPill({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  const Icon = TONE_ICON[tone]
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", TONE_CLASS[tone])}>
      <Icon className="size-3" />
      {children}
    </span>
  )
}

function SectionHeader({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: typeof Database
  title: string
  description: string
  action?: React.ReactNode
}) {
  return (
    <CardHeader className="border-b px-5 py-4 [.border-b]:pb-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="size-4" />
          </span>
          <div className="min-w-0">
            <CardTitle className="text-base">{title}</CardTitle>
            <CardDescription className="mt-0.5 text-xs">{description}</CardDescription>
          </div>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </CardHeader>
  )
}

function Metric({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="min-w-0 rounded-lg bg-muted/50 px-3 py-2.5">
      <p className="truncate text-xs text-muted-foreground">{label}</p>
      <div className="mt-0.5 truncate text-lg leading-snug font-semibold tabular-nums">{value}</div>
      {hint ? <p className="truncate text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

export default async function MonitoringDashboardPage() {
  const session = await auth()
  if (session?.user.role !== "SUPER_ADMIN") {
    redirect("/admin/dashboard")
  }

  const now = new Date()
  const [db, access, requests] = await Promise.all([
    getDatabaseHealth(),
    getAccessOverview(now).catch(() => null),
    getRequestActivity(now).catch(() => null),
  ])

  const dbTone: Tone = !db.ok ? "critical" : db.latencyMs > 200 ? "warning" : "good"
  const accessIssues = access
    ? access.superAdminsWithout2fa.length + access.lockedUsers.length + access.blockedIps.length
    : 0
  const failedRatio = requests && requests.logins + requests.failedLogins > 0
    ? requests.failedLogins / (requests.logins + requests.failedLogins)
    : 0
  const requestTone: Tone = !requests ? "critical" : failedRatio > 0.5 && requests.failedLogins >= 10 ? "critical" : requests.failedLogins >= 5 ? "warning" : "good"

  const summary = [
    {
      label: "Database",
      icon: Database,
      tone: dbTone,
      value: db.ok ? "Terhubung" : "Terputus",
      hint: db.ok ? `Respon ${db.latencyMs} ms` : "Periksa server database",
    },
    {
      label: "Hak Akses",
      icon: KeyRound,
      tone: (!access ? "critical" : access.superAdminsWithout2fa.length > 0 ? "critical" : accessIssues > 0 ? "warning" : "good") as Tone,
      value: !access ? "Gagal dimuat" : accessIssues === 0 ? "Aman" : `${accessIssues} perlu dicek`,
      hint: access ? `${access.lockedUsers.length} akun terkunci · ${access.blockedIps.length} IP diblokir` : "",
    },
    {
      label: "Aktivitas 24 Jam",
      icon: Activity,
      tone: requestTone,
      value: requests ? requests.total.toLocaleString("id-ID") : "-",
      hint: requests ? `${requests.failedLogins} login gagal` : "Gagal dimuat",
    },
  ]

  return (
    <div>
      <Breadcrumb
        items={[
          { label: "Dashboard", href: "/admin/dashboard" },
          { label: "Monitoring System" },
          { label: "Monitoring Dashboard" },
        ]}
      />
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Monitoring Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Kesehatan sistem, keamanan hak akses, aktivitas pengguna, dan pemeriksaan file upload.
          </p>
        </div>
        <AutoRefresh intervalSeconds={60} />
      </div>

      {/* Ringkasan status */}
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        {summary.map((item) => {
          const Icon = item.icon
          return (
            <Card key={item.label}>
              <CardContent className="flex items-center gap-3 px-5">
                <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg", TONE_CLASS[item.tone])}>
                  <Icon className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                  <p className="truncate text-lg leading-tight font-semibold">{item.value}</p>
                  <p className="truncate text-xs text-muted-foreground">{item.hint}</p>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        {/* Koneksi database */}
        <Card className="gap-0 py-0">
          <SectionHeader
            icon={Database}
            title="Koneksi Database"
            description="Hasil pengecekan saat halaman dimuat."
            action={
              <StatusPill tone={dbTone}>
                {db.ok ? (dbTone === "good" ? "Sehat" : "Lambat") : "Terputus"}
              </StatusPill>
            }
          />
          <CardContent className="p-5">
            {db.ok ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Metric label="Waktu respon" value={`${db.latencyMs} ms`} hint={db.latencyMs > 200 ? "Di atas 200 ms" : "Normal"} />
                <Metric label="Server" value={db.version.split("-")[0]} hint={db.version.includes("MariaDB") ? "MariaDB" : "MySQL"} />
                <Metric label="Database" value={db.databaseName} />
                <Metric label="Ukuran data" value={formatBytes(db.sizeBytes)} hint={`${db.tableCount} tabel`} />
                <Metric label="Koneksi aktif" value={db.connections ?? "-"} />
                <Metric label="Uptime server" value={db.uptimeSeconds !== null ? formatUptime(db.uptimeSeconds) : "-"} />
              </div>
            ) : (
              <div className="flex items-start gap-3 rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-sm">
                <XCircle className="mt-0.5 size-5 shrink-0 text-rose-600 dark:text-rose-400" />
                <div className="min-w-0">
                  <p className="font-medium">Tidak dapat terhubung ke database</p>
                  <p className="break-words text-xs text-muted-foreground">{db.error}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Hak akses */}
        <Card className="gap-0 py-0">
          <SectionHeader
            icon={KeyRound}
            title="Hak Akses"
            description="Akun per role, 2FA Super Admin, akun terkunci, dan IP yang diblokir."
            action={
              <Link href="/admin/akses-hr" className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium transition hover:bg-muted">
                Kelola <ArrowRight className="size-3" />
              </Link>
            }
          />
          <CardContent className="grid gap-4 p-5">
            {access ? (
              <>
                <div className="grid grid-cols-3 gap-3">
                  {access.roleCounts.map((r) => (
                    <div key={r.role} className="rounded-lg bg-muted/50 p-3">
                      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Users className="size-3.5" />
                        {ROLE_LABEL[r.role]}
                      </p>
                      <p className="mt-0.5 text-lg font-semibold tabular-nums">{r.active}</p>
                      <p className="text-xs text-muted-foreground">{r.inactive > 0 ? `akun aktif · ${r.inactive} nonaktif` : "akun aktif"}</p>
                    </div>
                  ))}
                </div>

                <ul className="divide-y rounded-lg border text-sm">
                  <li className="flex items-center justify-between gap-3 px-3 py-2.5">
                    <span className="flex items-center gap-2">
                      <ShieldCheck className="size-4 text-muted-foreground" />
                      2FA Super Admin
                    </span>
                    {access.superAdminsWithout2fa.length === 0 ? (
                      <StatusPill tone="good">Semua aktif</StatusPill>
                    ) : (
                      <StatusPill tone="critical">
                        Belum aktif: {access.superAdminsWithout2fa.join(", ")}
                      </StatusPill>
                    )}
                  </li>
                  <li className="flex items-center justify-between gap-3 px-3 py-2.5">
                    <span className="flex items-center gap-2">
                      <Lock className="size-4 text-muted-foreground" />
                      Akun terkunci
                    </span>
                    {access.lockedUsers.length === 0 ? (
                      <StatusPill tone="good">Tidak ada</StatusPill>
                    ) : (
                      <span className="truncate text-right text-xs" title={access.lockedUsers.map((u) => u.username).join(", ")}>
                        <StatusPill tone="warning">{access.lockedUsers.length} akun</StatusPill>{" "}
                        <span className="text-muted-foreground">
                          {access.lockedUsers.slice(0, 3).map((u) => u.username).join(", ")}
                        </span>
                      </span>
                    )}
                  </li>
                  <li className="flex items-center justify-between gap-3 px-3 py-2.5">
                    <span className="flex items-center gap-2">
                      <Network className="size-4 text-muted-foreground" />
                      IP diblokir
                    </span>
                    {access.blockedIps.length === 0 ? (
                      <StatusPill tone="good">Tidak ada</StatusPill>
                    ) : (
                      <StatusPill tone="warning">{access.blockedIps.length} IP</StatusPill>
                    )}
                  </li>
                </ul>

                {access.hrAdmins.length > 0 ? (
                  <div>
                    <p className="mb-2 text-xs font-medium text-muted-foreground">
                      Cakupan menu HR Admin (dari {access.totalMenuCount} menu)
                    </p>
                    <div className="grid gap-1.5">
                      {access.hrAdmins.slice(0, 6).map((hr) => (
                        <div key={hr.username} className="grid grid-cols-[8rem_minmax(0,1fr)_3ch] items-center gap-3 text-xs">
                          <span className="truncate">{hr.username}</span>
                          <div className="h-2 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${Math.round((hr.menuCount / Math.max(1, access.totalMenuCount)) * 100)}%`, backgroundColor: "var(--chart-1)" }}
                            />
                          </div>
                          <span className="text-right font-semibold tabular-nums">{hr.menuCount}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Data hak akses gagal dimuat.</p>
            )}
          </CardContent>
        </Card>

        {/* Aktivitas / request */}
        <Card className="gap-0 py-0 xl:col-span-2">
          <SectionHeader
            icon={Activity}
            title="Aktivitas Request (24 Jam)"
            description="Dari Log Aktivitas: login, perubahan data, unduhan, dan aksi lain. Bukan access log HTTP server."
            action={
              <Link href="/admin/log-aktivitas" className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium transition hover:bg-muted">
                Log Aktivitas <ArrowRight className="size-3" />
              </Link>
            }
          />
          <CardContent className="p-5">
            {requests ? (
              <div className="grid gap-5">
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <Metric label="Total aktivitas" value={requests.total.toLocaleString("id-ID")} hint="24 jam terakhir" />
                  <Metric label="Login berhasil" value={requests.logins} />
                  <Metric
                    label="Login gagal"
                    value={
                      <span className="flex items-center gap-2">
                        {requests.failedLogins}
                        {requests.failedLogins > 0 ? (
                          <StatusPill tone={requestTone === "good" ? "warning" : requestTone}>
                            {Math.round(failedRatio * 100)}%
                          </StatusPill>
                        ) : null}
                      </span>
                    }
                  />
                  <Metric label="IP unik" value={requests.uniqueIps} />
                </div>

                <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                <div className="min-w-0">
                  <p className="mb-6 text-xs font-medium text-muted-foreground">Aktivitas per jam</p>
                  <HourlyActivityChart buckets={requests.hourly} />
                </div>

                <div>
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <LogIn className="size-3.5" />
                    IP dengan login gagal terbanyak
                  </p>
                  {requests.topFailedIps.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                      <ShieldCheck className="size-6 text-emerald-600 dark:text-emerald-400" />
                      Tidak ada login gagal dalam 24 jam.
                    </div>
                  ) : (
                    <ul className="divide-y rounded-lg border text-sm">
                      {requests.topFailedIps.map((ip) => (
                        <li key={ip.ip} className="flex items-center justify-between gap-3 px-3 py-2">
                          <div className="min-w-0">
                            <p className="truncate font-mono text-xs">{ip.ip}</p>
                            <p className="truncate text-xs text-muted-foreground">terakhir: {ip.lastUsername}</p>
                          </div>
                          <span className="shrink-0 font-semibold tabular-nums">{ip.count}×</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {access && access.blockedIps.length > 0 ? (
                    <>
                      <p className="mt-4 mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <ShieldAlert className="size-3.5" />
                        IP sedang diblokir
                      </p>
                      <ul className="divide-y rounded-lg border text-sm">
                        {access.blockedIps.slice(0, 5).map((b) => (
                          <li key={b.ip} className="flex items-center justify-between gap-3 px-3 py-2">
                            <span className="truncate font-mono text-xs">{b.ip}</span>
                            <span className="shrink-0 text-xs text-muted-foreground">
                              {b.permanent ? "Permanen" : b.blockedUntil ? `s.d. ${formatDateTime(b.blockedUntil)}` : "-"}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : null}
                </div>
              </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Data aktivitas gagal dimuat.</p>
            )}
          </CardContent>
        </Card>

        {/* Malware scanner */}
        <Card className="gap-0 py-0 xl:col-span-2">
          <SectionHeader
            icon={ScanSearch}
            title="Scanner File Upload"
            description="Cari file mencurigakan (web shell, skrip, executable) di folder upload."
          />
          <CardContent className="p-5">
            <MalwareScanPanel />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
