import {
  CalendarClock,
  CalendarDays,
  ClipboardCheck,
  FileText,
  LogIn,
  LogOut,
  MapPin,
  ReceiptText,
  Zap,
} from "lucide-react";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getEmployeeLeaveBalance } from "@/lib/leave-balance";
import {
  getEmployeeMonthlySubmissionCount,
  getEmployeePendingApprovalCount,
  getEmployeeQuickAccessCounts,
  getEmployeeAttendanceHistory,
} from "@/lib/employee-dashboard-stats";
import { getGreeting } from "@/lib/greeting";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { EmployeeIzinQuickAccess } from "@/components/employee-izin-quick-access";
import { DashboardBlueprintCard } from "@/components/dashboard-blueprint-card";
import { EmployeeRecentAttendance } from "@/components/employee-recent-attendance";
import Link from "next/link";

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

function formatClockTime(date: Date) {
  return date.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

const MONTH_NAMES = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

function formatRupiah(value: number) {
  return `Rp${Math.round(value).toLocaleString("id-ID")}`;
}

export default async function EmployeeDashboardPage() {
  const now = new Date();
  const session = await auth();
  const employee = session?.user.employeeId
    ? await prisma.employee.findUnique({
        where: { id: session.user.employeeId },
        include: {
          department: true,
          position: true,
          workShift: { select: { checkInTime: true, checkOutTime: true } },
        },
      })
    : null;

  if (!employee) {
    return (
      <div>
        <h1 className="mb-6 text-2xl font-semibold">Selamat datang</h1>
        <p className="text-muted-foreground">
          Akun Anda belum terhubung ke data pegawai. Hubungi admin.
        </p>
      </div>
    );
  }

  const todayValue = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const rangeStartValue = new Date(now);
  rangeStartValue.setDate(rangeStartValue.getDate() - 30);
  const rangeFromValue = `${rangeStartValue.getFullYear()}-${String(rangeStartValue.getMonth() + 1).padStart(2, "0")}-${String(rangeStartValue.getDate()).padStart(2, "0")}`;

  const [
    quickAccess,
    pendingApprovalCount,
    monthlySubmissionCount,
    leaveBalance,
    attendanceHistory,
    latestPayslip,
  ] = await Promise.all([
    getEmployeeQuickAccessCounts(employee.id),
    getEmployeePendingApprovalCount(employee.id),
    getEmployeeMonthlySubmissionCount(employee.id, now),
    getEmployeeLeaveBalance(employee.id, now.getFullYear()),
    employee.pinAttendance
      ? getEmployeeAttendanceHistory(
          employee.pinAttendance,
          {
            from: new Date(`${rangeFromValue}T00:00:00`),
            to: new Date(`${todayValue}T23:59:59.999`),
          },
          employee.workShift,
        )
      : Promise.resolve([]),
    // Cuma slip dari periode LOCKED (final/disetujui) — sama aturannya
    // dengan halaman Slip Gaji & tombol Unduh (lihat
    // app/pegawai/slip-gaji/page.tsx).
    prisma.payslip.findFirst({
      where: { employeeId: employee.id, payrollPeriod: { status: "LOCKED" } },
      orderBy: { payrollPeriod: { periodStart: "desc" } },
      select: { netPay: true, payrollPeriod: { select: { month: true, year: true } } },
    }),
  ]);

  const recentAttendance = attendanceHistory.slice(0, 10);
  const todayRow =
    attendanceHistory[0]?.date.toDateString() === now.toDateString()
      ? attendanceHistory[0]
      : null;

  const greeting = getGreeting(employee.fullName.split(" ")[0], now);

  const stats = [
    {
      label: "Sisa Cuti Tahun Ini",
      value: `${leaveBalance.remaining} hari`,
      icon: CalendarDays,
      chip: "bg-white/10 text-blue-300",
    },
    {
      label: "Menunggu Approval",
      value: pendingApprovalCount,
      icon: ClipboardCheck,
      chip: "bg-white/10 text-rose-300",
    },
    {
      label: "Pengajuan Bulan Ini",
      value: monthlySubmissionCount,
      icon: FileText,
      chip: "bg-white/10 text-emerald-300",
    },
  ];

  return (
    <div className="grid gap-6">
      {/* Hero: di desktop profil kiri (span 2 baris) + greeting & statistik
          kanan; di mobile disusun greeting → profil → statistik lewat order. */}
      <div className="grid gap-4 lg:grid-cols-2 lg:grid-rows-[auto_1fr]">
        {/* Greeting */}
        <div className="order-1 lg:order-none lg:col-start-2 lg:row-start-1">
          <h1 className="text-3xl font-semibold sm:text-4xl">{greeting}</h1>
        </div>

        {/* Kartu profil */}
        <Card className="relative order-2 overflow-hidden border-0 bg-blue-950 text-white shadow-lg shadow-blue-950/20 lg:order-none lg:col-start-1 lg:row-span-2">
          <div className="pointer-events-none absolute -top-16 -right-16 size-48 rounded-full bg-blue-400/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 -left-10 size-40 rounded-full bg-sky-400/10 blur-3xl" />
          <CardContent className="relative flex h-full flex-col justify-center px-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <Avatar className="size-14 ring-2 ring-white/30">
                  <AvatarImage
                    src={employee.photoUrl ?? undefined}
                    alt={employee.fullName}
                  />
                  <AvatarFallback className="bg-white/15 text-base font-semibold text-white">
                    {initials(employee.fullName)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold">
                    {employee.fullName}
                  </p>
                  <p className="text-sm text-white/75">
                    {employee.position.name} · NIP {employee.employeeNumber} ·{" "}
                    {employee.department.name}
                  </p>
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
                <p className="flex items-center gap-1.5 text-xs text-white/60">
                  <LogIn className="size-3.5" />
                  Jam Masuk Hari Ini
                </p>
                <p className="mt-1 truncate text-2xl font-bold tabular-nums">
                  {todayRow ? formatClockTime(todayRow.checkIn) : "-"}
                </p>
                {todayRow ? (
                  <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-white/60">
                    <MapPin className="size-3 shrink-0" />
                    {todayRow.checkInLocation}
                  </p>
                ) : null}
              </div>
              <div className="rounded-lg bg-white/10 p-3">
                <p className="flex items-center gap-1.5 text-xs text-white/60">
                  <LogOut className="size-3.5" />
                  Jam Pulang Hari Ini
                </p>
                <p className="mt-1 truncate text-2xl font-bold tabular-nums">
                  {todayRow?.checkOut
                    ? formatClockTime(todayRow.checkOut)
                    : "-"}
                </p>
                {todayRow?.checkOut && todayRow.checkOutLocation ? (
                  <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-white/60">
                    <MapPin className="size-3 shrink-0" />
                    {todayRow.checkOutLocation}
                  </p>
                ) : null}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Statistik ringkas — satu panel navy senada kartu profil di
            sebelahnya (bukan lagi kotak pastel terpisah-pisah). Kontennya
            dipusatkan vertikal karena kartu ini ikut di-stretch mengikuti
            tinggi kartu profil di sebelahnya. */}
        <Card className="order-3 flex justify-center overflow-hidden border-0 bg-blue-950 py-0 text-white shadow-lg shadow-blue-950/20 lg:order-none lg:col-start-2 lg:row-start-2">
          <CardContent className="px-4 py-4">
            <div className="grid grid-cols-1 gap-4 divide-y divide-white/10 sm:grid-cols-3 sm:gap-0 sm:divide-x sm:divide-y-0">
              {stats.map((stat) => {
                const Icon = stat.icon;
                return (
                  <div
                    key={stat.label}
                    className="flex items-center gap-3 pb-4 last:pb-0 sm:px-4 sm:pb-0 sm:first:pl-0 sm:last:pr-0"
                  >
                    <span
                      className={cn(
                        "flex size-9 shrink-0 items-center justify-center rounded-lg",
                        stat.chip,
                      )}
                    >
                      <Icon className="size-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-xs text-white/60">
                        {stat.label}
                      </p>
                      <p className="text-lg font-semibold tabular-nums text-white">
                        {stat.value}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      <div>
        <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
          <Zap className="size-4" />
          Akses Cepat Izin
        </p>
        <EmployeeIzinQuickAccess items={quickAccess} />
      </div>

      <div className="grid items-start gap-4 sm:grid-cols-2">
        {employee.pinAttendance ? (
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-2">
              <div>
                <CardTitle>Riwayat Absensi</CardTitle>
                <CardDescription>
                  {recentAttendance.length} kehadiran terakhir dari mesin
                  fingerprint.
                </CardDescription>
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

        {latestPayslip ? (
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-2">
              <div>
                <CardTitle>Slip Gaji</CardTitle>
                <CardDescription>
                  Periode {MONTH_NAMES[latestPayslip.payrollPeriod.month - 1]}{" "}
                  {latestPayslip.payrollPeriod.year} — slip terbaru Anda.
                </CardDescription>
              </div>
              <Link
                href="/pegawai/slip-gaji"
                className="shrink-0 text-xs font-medium text-primary hover:underline"
              >
                Lihat semua
              </Link>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">Gaji Bersih (Take Home Pay)</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">
                {formatRupiah(latestPayslip.netPay)}
              </p>
            </CardContent>
          </Card>
        ) : (
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
        )}
      </div>
    </div>
  );
}





























































































































     









 
































































