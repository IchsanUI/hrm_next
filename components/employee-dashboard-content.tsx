import {
  CalendarDays,
  ClipboardCheck,
  FileText,
  LogIn,
  LogOut,
  MapPin,
  Zap,
} from "lucide-react";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { SHIFT_SCHEDULE_SELECT } from "@/lib/attendance/shift-schedule";
import { getEmployeeLeaveBalance } from "@/lib/leave-balance";
import {
  getEmployeeMonthlySubmissionCount,
  getEmployeePendingApprovalCount,
  getEmployeeQuickAccessCounts,
  getEmployeeAttendanceHistory,
} from "@/lib/employee-dashboard-stats";
import { getBirthdaysTomorrow } from "@/lib/dashboard-stats";
import { getGreeting } from "@/lib/greeting";
import { cn, toTitleCase } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { EmployeeIzinQuickAccess } from "@/components/employee-izin-quick-access";
import { AttendanceNotLinkedNotice } from "@/components/attendance-not-linked-notice";
import { EmployeeRecentAttendance } from "@/components/employee-recent-attendance";
import { TeamFeedPreviewCard } from "@/components/team-feed-preview-card";
import { BirthdayTomorrowCard } from "@/components/birthday-tomorrow-card";
import Link from "next/link";
import { LiveClock } from "@/components/live-clock";

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

// Isi dashboard pegawai (statistik pribadi: cuti, absensi, approval sendiri)
// — dipakai LANGSUNG oleh app/pegawai/dashboard/page.tsx (role EMPLOYEE),
// DAN oleh app/admin/dashboard/page.tsx untuk role HR_ADMIN (yang punya
// employeeId) supaya HR_ADMIN tetap lihat dashboard versi pegawai walau
// masuk lewat shell /admin — cuma menu sidebar-nya yang bertambah sesuai
// menuAccess, dashboard-nya TIDAK ikut berubah jadi versi company-wide.
export async function EmployeeDashboardContent() {
  const now = new Date();
  const session = await auth();
  const employee = session?.user.employeeId
    ? await prisma.employee.findUnique({
        where: { id: session.user.employeeId },
        include: {
          department: true,
          position: true,
          workShift: { select: SHIFT_SCHEDULE_SELECT },
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
    birthdayTomorrow,
    attendanceHistory,
  ] = await Promise.all([
    getEmployeeQuickAccessCounts(employee.id),
    getEmployeePendingApprovalCount(employee.id),
    getEmployeeMonthlySubmissionCount(employee.id, now),
    getEmployeeLeaveBalance(employee.id, now.getFullYear()),
    getBirthdaysTomorrow(now),
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
  ]);

  const recentAttendance = attendanceHistory.slice(0, 10);
  const todayRow =
    attendanceHistory[0]?.date.toDateString() === now.toDateString()
      ? attendanceHistory[0]
      : null;

  const greeting = getGreeting(toTitleCase(employee.fullName), now);

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
      {/* Header salam + jam — disembunyikan di mobile/tablet (kartu profil di
          bawah sudah menampilkan nama pegawai, jadi tidak duplikat informasi
          di layar sempit), tetap tampil di desktop. */}
      <div className="hidden items-end justify-between gap-4 lg:flex">
        <div className="min-w-0">
          <p className="text-sm font-medium text-primary">{greeting.label}</p>
          <h1 className="truncate text-3xl font-bold sm:text-4xl">
            {greeting.name}
          </h1>
        </div>
        <div className="shrink-0 text-right">
          <LiveClock />
        </div>
      </div>

      {/* Hero: kartu profil + absensi hari ini (2/3 lebar) dan ringkasan
          statistik bersusun (1/3 lebar); di mobile keduanya ditumpuk. */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="relative overflow-hidden border-0 bg-blue-950 py-0 text-white shadow-lg shadow-blue-950/20 lg:col-span-2">
          <div className="pointer-events-none absolute -top-16 -right-16 size-48 rounded-full bg-blue-400/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 -left-10 size-40 rounded-full bg-sky-400/10 blur-3xl" />
          <CardContent className="relative flex h-full flex-col justify-between gap-5 p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3.5">
                <Avatar className="size-14 shrink-0 ring-2 ring-white/30">
                  <AvatarImage
                    src={employee.photoUrl ?? undefined}
                    alt={employee.fullName}
                  />
                  <AvatarFallback className="bg-white/15 text-base font-semibold text-white">
                    {initials(employee.fullName)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate text-lg leading-tight font-semibold">
                    {toTitleCase(employee.fullName)}
                  </p>
                  <p className="mt-0.5 truncate text-sm text-white/80">
                    {employee.position.name}
                  </p>
                  <p className="truncate text-xs text-white/60">
                    NIP {employee.employeeNumber} · {employee.department.name}
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

            <div>
              <p className="mb-2 text-xs font-medium tracking-wide text-white/60 uppercase">
                Absensi Hari Ini
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-white/10 p-3">
                  <p className="flex items-center gap-1.5 text-xs text-white/60">
                    <LogIn className="size-3.5" />
                    Jam Masuk
                  </p>
                  <p className="mt-1 truncate text-2xl font-bold tabular-nums">
                    {todayRow ? formatClockTime(todayRow.checkIn) : "—"}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-white/60">
                    {todayRow ? (
                      <>
                        <MapPin className="size-3 shrink-0" />
                        {todayRow.checkInLocation}
                      </>
                    ) : (
                      "Belum absen masuk"
                    )}
                  </p>
                </div>
                <div className="rounded-lg bg-white/10 p-3">
                  <p className="flex items-center gap-1.5 text-xs text-white/60">
                    <LogOut className="size-3.5" />
                    Jam Pulang
                  </p>
                  <p className="mt-1 truncate text-2xl font-bold tabular-nums">
                    {todayRow?.checkOut
                      ? formatClockTime(todayRow.checkOut)
                      : "—"}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-white/60">
                    {todayRow?.checkOut ? (
                      todayRow.checkOutLocation ? (
                        <>
                          <MapPin className="size-3 shrink-0" />
                          {todayRow.checkOutLocation}
                        </>
                      ) : null
                    ) : (
                      "Belum absen pulang"
                    )}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Statistik ringkas — panel navy senada kartu profil di sebelahnya,
            tiga baris bersusun dengan nilai rata kanan. */}
        <Card className="overflow-hidden border-0 bg-blue-950 py-0 text-white shadow-lg shadow-blue-950/20">
          <CardContent className="flex h-full flex-col p-5">
            <p className="mb-1 text-xs font-medium tracking-wide text-white/60 uppercase">
              Ringkasan
            </p>
            <div className="flex flex-1 flex-col justify-center divide-y divide-white/10">
              {stats.map((stat) => {
                const Icon = stat.icon;
                return (
                  <div
                    key={stat.label}
                    className="flex items-center gap-3 py-3 first:pt-2 last:pb-0"
                  >
                    <span
                      className={cn(
                        "flex size-9 shrink-0 items-center justify-center rounded-lg",
                        stat.chip,
                      )}
                    >
                      <Icon className="size-4" />
                    </span>
                    <p className="min-w-0 flex-1 truncate text-sm text-white/75">
                      {stat.label}
                    </p>
                    <p className="shrink-0 text-xl font-semibold tabular-nums text-white">
                      {stat.value}
                    </p>
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

      <BirthdayTomorrowCard birthdays={birthdayTomorrow} viewerEmployeeId={employee.id} />

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
          <Card>
            <CardHeader>
              <CardTitle>Riwayat Absensi</CardTitle>
              <CardDescription>Rekap kehadiran Anda.</CardDescription>
            </CardHeader>
            <CardContent>
              <AttendanceNotLinkedNotice />
            </CardContent>
          </Card>
        )}

        <TeamFeedPreviewCard employeeId={employee.id} />
      </div>
    </div>
  );
}
