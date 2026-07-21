import Link from "next/link"
import {
  ArrowRight,
  Building2,
  Cake,
  CalendarClock,
  ClipboardCheck,
  Landmark,
  ReceiptText,
  Users,
} from "lucide-react"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import {
  getBirthdaysThisMonth,
  getDepartmentDistribution,
  getIzinFrequencyAndTrend,
  getPendingApprovalCount,
  getRecentActivity,
} from "@/lib/dashboard-stats"
import { getGreeting } from "@/lib/greeting"
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
import { DashboardBlueprintCard } from "@/components/dashboard-blueprint-card"

export default async function AdminDashboardPage() {
  const now = new Date()
  const session = await auth()
  const employeeIdForGreeting = session?.user.employeeId

  const [
    employeeCount,
    departmentCount,
    positionCount,
    pendingApprovalCount,
    { frequency, trend },
    departmentDistribution,
    birthdays,
    recentActivity,
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
        <p className="text-lg font-semibold text-foreground sm:text-xl">{greeting}</p>
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
            <div className="flex-1">
              <DashboardBlueprintCard
                title="Absensi Hari Ini"
                description="Rekap kehadiran pegawai."
                icon={CalendarClock}
                href="/admin/absensi"
                color="blue"
                plannedFeatures={[
                  "Rekap hadir/terlambat/tidak hadir harian",
                  "Terhubung mesin fingerprint",
                ]}
              />
            </div>
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

            <div className="flex-1">
              <DashboardBlueprintCard
                title="Riwayat Slip Gaji"
                description="Slip gaji yang sudah diproses per periode."
                icon={ReceiptText}
                href="/admin/payroll/slip-gaji"
                color="violet"
                plannedFeatures={[
                  "Riwayat slip gaji per pegawai per periode",
                  "Rincian komponen pendapatan & potongan",
                  "Unduh slip gaji format PDF",
                ]}
              />
            </div>
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
