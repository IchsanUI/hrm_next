import { CalendarClock, CalendarDays, ClipboardCheck, FileText, ReceiptText } from "lucide-react"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { getEmployeeLeaveBalance } from "@/lib/leave-balance"
import {
  getEmployeeMonthlySubmissionCount,
  getEmployeePendingApprovalCount,
  getEmployeeQuickAccessCounts,
  getEmployeeRecentAttendance,
} from "@/lib/employee-dashboard-stats"
import { getGreeting } from "@/lib/greeting"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { EmployeeIzinQuickAccess } from "@/components/employee-izin-quick-access"
import { DashboardBlueprintCard } from "@/components/dashboard-blueprint-card"
import { EmployeeRecentAttendance } from "@/components/employee-recent-attendance"
import Link from "next/link"

function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase()
}

export default async function EmployeeDashboardPage() {
  const now = new Date()
  const session = await auth()
  const employee = session?.user.employeeId
    ? await prisma.employee.findUnique({
        where: { id: session.user.employeeId },
        include: { department: true, position: true },
      })
    : null

  if (!employee) {
    return (
      <div>
        <h1 className="mb-6 text-2xl font-semibold">Selamat datang</h1>
        <p className="text-muted-foreground">
          Akun Anda belum terhubung ke data pegawai. Hubungi admin.
        </p>
      </div>
    )
  }

  const [quickAccess, pendingApprovalCount, monthlySubmissionCount, leaveBalance, recentAttendance] =
    await Promise.all([
      getEmployeeQuickAccessCounts(employee.id),
      getEmployeePendingApprovalCount(employee.id),
      getEmployeeMonthlySubmissionCount(employee.id, now),
      getEmployeeLeaveBalance(employee.id, now.getFullYear()),
      employee.pinAttendance ? getEmployeeRecentAttendance(employee.pinAttendance) : Promise.resolve([]),
    ])

  const greeting = getGreeting(employee.fullName.split(" ")[0], now)
  const monthLabel = now.toLocaleDateString("id-ID", { month: "long", year: "numeric" })

  const stats = [
    {
      label: "Sisa Cuti Tahun Ini",
      value: `${leaveBalance.remaining} hari`,
      icon: CalendarDays,
      card: "bg-blue-50/60 dark:bg-blue-500/[0.05]",
      chip: "bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400",
      value_color: "text-blue-700 dark:text-blue-300",
    },
    {
      label: "Menunggu Approval",
      value: pendingApprovalCount,
      icon: ClipboardCheck,
      card: "bg-rose-50/60 dark:bg-rose-500/[0.05]",
      chip: "bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400",
      value_color: "text-rose-700 dark:text-rose-300",
    },
    {
      label: "Pengajuan Bulan Ini",
      value: monthlySubmissionCount,
      icon: FileText,
      card: "bg-emerald-50/60 dark:bg-emerald-500/[0.05]",
      chip: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400",
      value_color: "text-emerald-700 dark:text-emerald-300",
    },
  ]

  return (
    <div className="grid gap-6">
      {/* Hero: di desktop profil kiri (span 2 baris) + greeting & statistik
          kanan; di mobile disusun greeting → profil → statistik lewat order. */}
      <div className="grid gap-4 lg:grid-cols-2 lg:grid-rows-[auto_1fr]">
        {/* Greeting */}
        <div className="order-1 lg:order-none lg:col-start-2 lg:row-start-1">
          <h1 className="text-3xl font-semibold sm:text-4xl">{greeting}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {employee.position.name} · {employee.department.name} — {monthLabel}
          </p>
        </div>

        {/* Kartu profil */}
        <Card className="relative order-2 overflow-hidden border-0 bg-blue-950 text-white lg:order-none lg:col-start-1 lg:row-span-2">
          {/* Aksen dekoratif — lingkaran blur translucent buat kedalaman,
              tidak mengganggu teks (pointer-events-none). */}
          <div className="pointer-events-none absolute -top-10 -right-8 size-40 rounded-full bg-white/10 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-12 -left-8 size-32 rounded-full bg-blue-400/20 blur-2xl" />
          <CardContent className="relative flex h-full flex-col justify-center px-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <Avatar className="size-14 ring-2 ring-white/30">
                  <AvatarImage src={employee.photoUrl ?? undefined} alt={employee.fullName} />
                  <AvatarFallback className="bg-white/15 text-base font-semibold text-white">
                    {initials(employee.fullName)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold">{employee.fullName}</p>
                  <p className="truncate text-sm text-white/75">{employee.position.name}</p>
                </div>
              </div>
              {employee.isActive ? (
                <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-xs font-medium backdrop-blur">
                  <span className="size-1.5 rounded-full bg-emerald-300" />
                  Aktif
                </span>
              ) : null}
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-white/10 p-3">
                <p className="text-xs text-white/60">NIP</p>
                <p className="mt-0.5 truncate text-sm font-semibold">{employee.employeeNumber}</p>
              </div>
              <div className="rounded-lg bg-white/10 p-3">
                <p className="text-xs text-white/60">Bagian</p>
                <p className="mt-0.5 truncate text-sm font-semibold">{employee.department.name}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Statistik ringkas */}
        <div className="order-3 grid grid-cols-1 gap-3 sm:grid-cols-3 lg:order-none lg:col-start-2 lg:row-start-2">
          {stats.map((stat) => {
            const Icon = stat.icon
            return (
              <div
                key={stat.label}
                className={cn(
                  "flex items-center justify-between gap-2 rounded-xl border p-4",
                  stat.card
                )}
              >
                <div className="min-w-0">
                  <p className="truncate text-xs text-muted-foreground">{stat.label}</p>
                  <p className={cn("text-lg font-semibold tabular-nums", stat.value_color)}>
                    {stat.value}
                  </p>
                </div>
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-lg",
                    stat.chip
                  )}
                >
                  <Icon className="size-4" />
                </span>
              </div>
            )
          })}
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-muted-foreground">Akses Cepat Izin</p>
        <EmployeeIzinQuickAccess items={quickAccess} />
      </div>

      <div className="grid items-start gap-4 sm:grid-cols-2">
        {employee.pinAttendance ? (
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-2">
              <div>
                <CardTitle>Riwayat Absensi</CardTitle>
                <CardDescription>5 kehadiran terakhir dari mesin fingerprint.</CardDescription>
              </div>
              <Link
                href="/pegawai/absensi"
                className="shrink-0 text-xs font-medium text-primary hover:underline"
              >
                Lihat semua
              </Link>
            </CardHeader>
            <CardContent>
              <EmployeeRecentAttendance rows={recentAttendance} />
            </CardContent>
          </Card>
        ) : (
          <DashboardBlueprintCard
            title="Riwayat Absensi"
            description="Rekap kehadiran Anda."
            icon={CalendarClock}
            href="/pegawai/absensi"
            color="blue"
            plannedFeatures={[
              "Terhubung otomatis begitu PIN mesin fingerprint Anda dipetakan oleh admin",
              "Rekap hadir/terlambat/tidak hadir harian",
            ]}
          />
        )}

        <DashboardBlueprintCard
          title="Slip Gaji"
          description="Riwayat slip gaji Anda per periode."
          icon={ReceiptText}
          href="/pegawai/slip-gaji"
          color="violet"
          plannedFeatures={[
            "Riwayat slip gaji Anda per periode",
            "Rincian komponen pendapatan & potongan",
            "Unduh slip gaji format PDF",
          ]}
        />
      </div>
    </div>
  )
}
