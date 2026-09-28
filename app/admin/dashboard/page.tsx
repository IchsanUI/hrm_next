import Link from "next/link"
import {
  ArrowRight,
  Building2,
  Cake,
  ClipboardCheck,
  Landmark,
  UserCheck,
  UserX,
  Users,
} from "lucide-react"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import {
  getBirthdaysThisMonth,
  getDepartmentDistribution,
  getIzinFrequencyAndTrend,
  getPayrollPeriodSummary,
  getPendingApprovalCount,
  getRecentActivity,
  getTodayAttendanceSnapshot,
  getTodayAttendanceSummary,
  type PayrollPeriodSummaryRow,
} from "@/lib/dashboard-stats"
import { getGreeting } from "@/lib/greeting"
import {
  PAYROLL_STATUS_LABEL,
  PAYROLL_STATUS_BADGE_VARIANT,
} from "@/lib/payroll/status-labels"
import type { PayrollPeriodStatus } from "@prisma/client"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { HorizontalBarChart, MonthlyColumnChart } from "@/components/dashboard-charts"
import { DonutChart } from "@/components/dashboard-donut-chart"
import { BirthdayList } from "@/components/birthday-list"
import { DashboardRecentActivity } from "@/components/dashboard-recent-activity"
import { DashboardAttendanceSnapshot } from "@/components/dashboard-attendance-snapshot"
import { EmployeeDashboardContent } from "@/components/employee-dashboard-content"

// Angka payroll di dashboard diringkas (mis. "Rp 26,4 jt") — total gaji
// seluruh pegawai bisa 9 digit, dan ditulis penuh justru bikin kartunya
// sesak dan susah dibaca sekilas. Angka lengkapnya ada di halaman periode.
function formatCurrencyShort(value: number): string {
  if (value >= 1_000_000_000) return `Rp ${(value / 1_000_000_000).toFixed(1).replace(".", ",")} M`
  if (value >= 1_000_000) return `Rp ${(value / 1_000_000).toFixed(1).replace(".", ",")} jt`
  if (value >= 1_000) return `Rp ${(value / 1_000).toFixed(0)} rb`
  return `Rp ${value}`
}

export default async function AdminDashboardPage() {
  const now = new Date()
  const session = await auth()

  // HR_ADMIN adalah pegawai biasa yang DIBERI menu admin tambahan (lihat
  // server/actions/access.ts setHrAdminAccessAction), bukan akun terpisah —
  // jadi Dashboard-nya TETAP versi pegawai (statistik pribadi), cuma menu
  // sidebar-nya saja yang bertambah sesuai menuAccess. SUPER_ADMIN tidak
  // terpengaruh, tetap lihat dashboard company-wide di bawah. Fallback ke
  // company-wide juga untuk HR_ADMIN TANPA employeeId (akun sistem murni
  // dari Manajemen Pengguna, createSystemAccountAction) — tidak ada data
  // pegawai buat ditampilkan.
  if (session?.user.role === "HR_ADMIN" && session.user.employeeId) {
    return <EmployeeDashboardContent />
  }

  const employeeIdForGreeting = session?.user.employeeId
  const isSuperAdmin = session?.user.role === "SUPER_ADMIN"

  const [
    employeeCount,
    departmentCount,
    positionCount,
    pendingApprovalCount,
    { frequency, trend },
    departmentDistribution,
    birthdays,
    recentActivity,
    todayAttendance,
    todayAttendanceSnapshot,
    payrollSummary,
    greetingEmployee,
  ] = await Promise.all([
    prisma.employee.count({ where: { isDeleted: false } }),
    prisma.department.count(),
    prisma.position.count(),
    getPendingApprovalCount(),
    getIzinFrequencyAndTrend(now),
    getDepartmentDistribution(),
    getBirthdaysThisMonth(now),
    getRecentActivity(8),
    getTodayAttendanceSummary(now),
    getTodayAttendanceSnapshot(now, 5),
    getPayrollPeriodSummary(3),
    employeeIdForGreeting
      ? prisma.employee.findUnique({
          where: { id: employeeIdForGreeting },
          select: { fullName: true },
        })
      : Promise.resolve(null),
  ])

  const displayName =
    greetingEmployee?.fullName?.split(" ")[0] ?? session?.user.username ?? "Admin"
  const greeting = getGreeting(displayName, now)

  const stats = [
    {
      label: "Total Pegawai Aktif",
      value: employeeCount,
      href: "/admin/pegawai",
      icon: Users,
      chip: "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400",
    },
    {
      label: "Total Bagian",
      value: departmentCount,
      href: "/admin/bagian",
      icon: Building2,
      chip: "bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400",
    },
    {
      label: "Total Jabatan",
      value: positionCount,
      href: "/admin/jabatan",
      icon: Landmark,
      chip: "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400",
    },
    {
      label: "Menunggu Approval",
      value: pendingApprovalCount,
      href: "/admin/approval-center",
      icon: ClipboardCheck,
      chip: "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400",
    },
    {
      label: "Ulang Tahun Bulan Ini",
      value: birthdays.length,
      href: undefined,
      icon: Cake,
      chip: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400",
    },
  ]

  const monthLabel = now.toLocaleDateString("id-ID", { month: "long", year: "numeric" })

  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard Admin</h1>
          <p className="text-sm text-muted-foreground">
            Ringkasan data pegawai dan aktivitas izin — {monthLabel}.
          </p>
        </div>
        <p className="text-lg font-semibold text-foreground sm:text-xl">
          {greeting.label} {greeting.name}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((stat) => {
          const Icon = stat.icon
          const inner = (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{stat.label}</p>
                <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", stat.chip)}>
                  <Icon className="size-4" />
                </span>
              </div>
              <p className="mt-3 text-2xl font-semibold tabular-nums">{stat.value}</p>
              {stat.href ? (
                <span className="mt-2 flex items-center gap-1 text-xs font-medium text-primary">
                  Lihat detail
                  <ArrowRight className="size-3" />
                </span>
              ) : null}
            </>
          )
          return stat.href ? (
            <Link key={stat.label} href={stat.href}>
              <Card className="h-full py-4 transition-shadow hover:shadow-md">
                <CardContent className="px-4">{inner}</CardContent>
              </Card>
            </Link>
          ) : (
            <Card key={stat.label} className="py-4">
              <CardContent className="px-4">{inner}</CardContent>
            </Card>
          )
        })}
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-3">
        {/* Kolom kiri (2/3): dua sub-kolom independen — Frekuensi ditumpuk
            dengan Ulang Tahun, Tren ditumpuk dengan Distribusi Bagian.
            Masing-masing sub-kolom punya jarak sendiri (gap-4) supaya tidak
            ikut terpengaruh tinggi kartu di sub-kolom sebelah. */}
        <div className="grid gap-4 lg:col-span-2 sm:grid-cols-2">
          <div className="flex flex-col gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Frekuensi Pengajuan Izin per Jenis</CardTitle>
                <CardDescription>Bulan {monthLabel}, diurutkan dari yang terbanyak.</CardDescription>
              </CardHeader>
              <CardContent>
                <DonutChart rows={frequency} centerLabel="Total Pengajuan" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Ulang Tahun Bulan Ini</CardTitle>
                <CardDescription>Bulan {monthLabel}.</CardDescription>
              </CardHeader>
              <CardContent>
                <BirthdayList birthdays={birthdays} today={now.getUTCDate()} />
              </CardContent>
            </Card>

            {/* flex-1: mengisi sisa tinggi kolom kiri supaya sejajar
                dengan bawah kolom kanan, tidak menyisakan ruang kosong. */}
            <Card className="flex-1">
              <CardHeader>
                <CardTitle>Absensi Hari Ini</CardTitle>
                <CardDescription>
                  Dari data mesin fingerprint, {todayAttendance.totalTerhubung} pegawai
                  terhubung.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-3 rounded-xl border bg-emerald-50/60 p-3 dark:bg-emerald-500/[0.05]">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400">
                    <UserCheck className="size-4.5" />
                  </span>
                  <div>
                    <p className="text-xs text-muted-foreground">Hadir</p>
                    <p className="text-xl font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">
                      {todayAttendance.hadir}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-xl border bg-rose-50/60 p-3 dark:bg-rose-500/[0.05]">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400">
                    <UserX className="size-4.5" />
                  </span>
                  <div>
                    <p className="text-xs text-muted-foreground">Belum Absen</p>
                    <p className="text-xl font-semibold tabular-nums text-rose-700 dark:text-rose-300">
                      {todayAttendance.belumAbsen}
                    </p>
                  </div>
                </div>
                <Link
                  href="/admin/absensi/data"
                  className="col-span-2 mt-1 flex items-center gap-1 text-xs font-medium text-primary"
                >
                  Lihat Data Absensi
                  <ArrowRight className="size-3" />
                </Link>
                <div className="col-span-2">
                  <DashboardAttendanceSnapshot rows={todayAttendanceSnapshot} />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-col gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Tren Pengajuan Izin</CardTitle>
                <CardDescription>Total per bulan, 6 bulan terakhir.</CardDescription>
              </CardHeader>
              <CardContent>
                <MonthlyColumnChart rows={trend} accentColor="var(--chart-7)" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Distribusi Pegawai per Bagian</CardTitle>
                <CardDescription>Jumlah pegawai aktif per bagian.</CardDescription>
              </CardHeader>
              <CardContent>
                <HorizontalBarChart
                  rows={departmentDistribution}
                  accentColor="var(--chart-5)"
                  emptyMessage="Belum ada data bagian."
                />
              </CardContent>
            </Card>

            {/* Modul Payroll sudah jadi, jadi slot ini tidak lagi berisi
                kartu "blueprint" yang keliru bilang belum aktif. Diganti
                ringkasan periode payroll nyata, dan SENGAJA cuma untuk
                SUPER_ADMIN — isinya total gaji dibayarkan seluruh pegawai.
                Penjagaan role ditulis eksplisit walau HR_ADMIN ber-employeeId
                sudah dialihkan ke dashboard pegawai di atas, karena akun
                sistem HR_ADMIN tanpa data pegawai tetap mendarat di sini. */}
            {isSuperAdmin ? (
              <Card className="flex-1">
                <CardHeader>
                  <CardTitle>Ringkasan Payroll</CardTitle>
                  <CardDescription>3 periode payroll terakhir.</CardDescription>
                </CardHeader>
                <CardContent>
                  {payrollSummary.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Belum ada periode payroll.</p>
                  ) : (
                    <div className="grid gap-3">
                      {payrollSummary.map((p: PayrollPeriodSummaryRow) => (
                        <Link
                          key={p.id}
                          href={`/admin/payroll/proses/${p.id}`}
                          className="flex items-start justify-between gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium">{p.label}</p>
                            <p className="text-xs text-muted-foreground">
                              {p.payslipCount} pegawai
                              {p.correctionCount > 0 ? ` · dikoreksi ${p.correctionCount}×` : ""}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-sm font-semibold tabular-nums">
                              {formatCurrencyShort(p.totalNetPay)}
                            </p>
                            <Badge
                              variant={PAYROLL_STATUS_BADGE_VARIANT[p.status as PayrollPeriodStatus]}
                              className="mt-1"
                            >
                              {PAYROLL_STATUS_LABEL[p.status as PayrollPeriodStatus]}
                            </Badge>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : null}
          </div>
        </div>

        {/* Kolom kanan (1/3): Aktivitas Terbaru sendirian, memanjang ke
            bawah mengikuti isinya (8 aktivitas). */}
        <Card>
          <CardHeader>
            <CardTitle>Aktivitas Terbaru</CardTitle>
            <CardDescription>8 aktivitas terakhir di seluruh sistem.</CardDescription>
          </CardHeader>
          <CardContent>
            <DashboardRecentActivity logs={recentActivity} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
