import Link from "next/link"
import { redirect } from "next/navigation"
import { AlertTriangle, CalendarCheck2, Clock, LogOut, UserCheck, UserMinus, UserX, Users } from "lucide-react"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { buildAttendanceMatrix, summarizeMonth, summarizeMonths, summarizeToday } from "@/lib/attendance/dashboard"
import { Breadcrumb } from "@/components/breadcrumb"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AttendanceDashboardFilters } from "@/components/attendance-dashboard-filters"
import { ColumnSeriesChart, DailyAttendanceChart, PercentBars, RankList } from "@/components/attendance-charts"

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"]
const MONTHS_LONG = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"]
const WEEKDAYS = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"]

function pct(v: number | null) {
  return v === null ? "-" : `${(v * 100).toFixed(1)}%`
}
function hm(d: Date | null) {
  return d ? `${String(d.getHours()).padStart(2, "0")}.${String(d.getMinutes()).padStart(2, "0")}` : "-"
}
function durationLabel(minutes: number) {
  if (minutes < 60) return `${minutes} menit`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m ? `${h} jam ${m} menit` : `${h} jam`
}

export default async function DashboardAbsensiPage({
  searchParams,
}: {
  searchParams: Promise<{ bulan?: string; bagian?: string }>
}) {
  const session = await auth()
  const user = session?.user
  const allowed =
    user?.role === "SUPER_ADMIN" || (user?.role === "HR_ADMIN" && user.menuAccess.includes("absensi.dashboard"))
  if (!allowed) redirect("/admin/dashboard")
  const canSeeEmployees =
    user.role === "SUPER_ADMIN" || user.menuAccess.includes("kepegawaian.pegawai")

  const now = new Date()
  const { bulan, bagian } = await searchParams
  const [by, bm] = (bulan ?? "").split("-").map(Number)
  const selected =
    by && bm >= 1 && bm <= 12 && new Date(by, bm - 1, 1) <= now ? new Date(by, bm - 1, 1) : new Date(now.getFullYear(), now.getMonth(), 1)
  const year = selected.getFullYear()
  const month = selected.getMonth()
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth()
  const departmentId = Number(bagian) || undefined

  // 12 bulan sampai bulan terpilih (untuk tren), dihitung sekali.
  const trendStart = new Date(year, month - 11, 1)
  const monthEnd = new Date(year, month + 1, 0)
  const [matrix, departments] = await Promise.all([
    buildAttendanceMatrix(trendStart, monthEnd, { departmentId }),
    prisma.department.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ])
  const summary = summarizeMonth(matrix, year, month)
  const today = isCurrentMonth ? summarizeToday(matrix) : null
  const trendMonths = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(year, month - 11 + i, 1)
    return { year: d.getFullYear(), month: d.getMonth() }
  })
  const trend = summarizeMonths(matrix, trendMonths)
  // Bulan dengan kehadiran sangat rendah biasanya tanda data mesin belum tersinkron.
  const suspicious = trend.filter((t) => t.expected > 0 && t.rate !== null && t.rate < 0.3)

  const monthOptions = Array.from({ length: 24 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    return { value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, label: `${MONTHS_LONG[d.getMonth()]} ${d.getFullYear()}` }
  })
  const monthValue = `${year}-${String(month + 1).padStart(2, "0")}`
  const employeeHref = (publicId: string) => (canSeeEmployees ? `/admin/pegawai/${publicId}/detail` : undefined)
  const { totals } = summary

  const monthStats = [
    { label: "Tingkat kehadiran", value: pct(totals.attendanceRate), hint: `${totals.present} dari ${totals.expected} hari kerja`, icon: UserCheck },
    { label: "Ketepatan waktu", value: pct(totals.punctualityRate), hint: "dari hari hadir", icon: CalendarCheck2 },
    { label: "Keterlambatan", value: `${totals.lateDays} kali`, hint: `total ${durationLabel(totals.lateMinutes)}`, icon: Clock },
    { label: "Pulang cepat", value: `${totals.earlyDays} kali`, hint: "sebelum jam pulang shift", icon: LogOut },
    { label: "Tidak hadir", value: `${totals.absentDays} hari`, hint: `tanpa tap & tanpa izin · izin ${totals.leaveDays} hari`, icon: UserX },
  ]

  return (
    <div>
      <Breadcrumb items={[{ label: "Dashboard", href: "/admin/dashboard" }, { label: "Absensi" }, { label: "Dashboard Absensi" }]} />
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold sm:text-2xl">Dashboard Absensi</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Kehadiran, keterlambatan, dan ketidakhadiran pegawai dari data mesin absensi.
          </p>
        </div>
        <AttendanceDashboardFilters
          month={monthValue}
          department={departmentId ? String(departmentId) : ""}
          months={monthOptions}
          departments={departments.map((d) => ({ value: String(d.id), label: d.name }))}
        />
      </div>

      {matrix.unmappedCount > 0 || suspicious.length > 0 ? (
        <div className="mb-6 grid gap-2">
          {matrix.unmappedCount > 0 ? (
            <p className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              {matrix.unmappedCount} pegawai aktif belum dipetakan PIN mesin absensinya sehingga tidak ikut dihitung. Atur di
              Data Pegawai → PIN Mesin Absensi.
            </p>
          ) : null}
          {suspicious.length > 0 ? (
            <p className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              Kehadiran sangat rendah di {suspicious.map((s) => `${MONTHS_LONG[s.month]} ${s.year}`).join(", ")}. Kemungkinan
              data mesin pada bulan tersebut belum tersinkron, bukan pegawainya tidak masuk.
            </p>
          ) : null}
        </div>
      ) : null}

      {/* ── Hari ini ───────────────────────────────────────── */}
      {today ? (
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
            Hari ini · {now.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </h2>
          {!today.isWorkday ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                {today.holidayName ? `Hari ini libur: ${today.holidayName}.` : "Hari ini bukan hari kerja."}
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
                {[
                  { label: "Terjadwal masuk", value: today.scheduledCount, icon: Users, tone: "" },
                  { label: "Sudah hadir", value: today.present.length, icon: UserCheck, tone: "text-emerald-600 dark:text-emerald-400" },
                  { label: "Terlambat", value: today.late.length, icon: Clock, tone: "text-amber-600 dark:text-amber-400" },
                  { label: "Pulang cepat", value: today.early.length, icon: LogOut, tone: "text-amber-600 dark:text-amber-400" },
                  { label: "Izin / cuti", value: today.leave.length, icon: CalendarCheck2, tone: "text-sky-600 dark:text-sky-400" },
                  { label: "Belum absen", value: today.notYet.length, icon: UserMinus, tone: "text-rose-600 dark:text-rose-400" },
                ].map((s) => (
                  <Card key={s.label} className="py-0">
                    <CardContent className="px-4 py-3.5">
                      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <s.icon className={`size-3.5 ${s.tone}`} />
                        {s.label}
                      </p>
                      <p className="mt-1 text-2xl font-semibold tabular-nums">{s.value}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <div className="grid gap-4 lg:grid-cols-3">
                <TodayList
                  title="Belum absen"
                  description="Hari kerja, belum ada tap, dan tidak sedang izin."
                  empty="Semua pegawai yang terjadwal sudah absen."
                  rows={today.notYet.map((r) => ({ key: r.employee.id, name: r.employee.name, sub: r.employee.department, right: "", href: employeeHref(r.employee.publicId) }))}
                />
                <TodayList
                  title="Terlambat hari ini"
                  description="Jam masuk dan lama keterlambatan."
                  empty="Tidak ada yang terlambat."
                  rows={[...today.late]
                    .sort((a, b) => b.record!.lateMinutes - a.record!.lateMinutes)
                    .map((r) => ({
                      key: r.employee.id,
                      name: r.employee.name,
                      sub: r.employee.department,
                      right: `${hm(r.record!.checkIn)} · +${r.record!.lateMinutes} mnt`,
                      href: employeeHref(r.employee.publicId),
                    }))}
                />
                <TodayList
                  title="Izin / cuti hari ini"
                  description="Tertutup izin yang sudah disetujui."
                  empty="Tidak ada yang izin hari ini."
                  rows={today.leave.map((r) => ({
                    key: r.employee.id,
                    name: r.employee.name,
                    sub: r.employee.department,
                    right: r.record!.leaveLabel ?? "",
                    href: employeeHref(r.employee.publicId),
                  }))}
                />
              </div>
            </>
          )}
        </section>
      ) : null}

      {/* ── Ringkasan bulan ─────────────────────────────────── */}
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          {MONTHS_LONG[month]} {year}
          {isCurrentMonth ? " · sampai hari ini" : ""}
        </h2>
        <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          {monthStats.map((s) => (
            <Card key={s.label} className="py-0">
              <CardContent className="px-4 py-3.5">
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <s.icon className="size-3.5" />
                  {s.label}
                </p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">{s.value}</p>
                <p className="truncate text-xs text-muted-foreground" title={s.hint}>
                  {s.hint}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="mb-4">
          <CardHeader className="border-b">
            <CardTitle>Kehadiran harian</CardTitle>
            <CardDescription>Komposisi status pegawai di setiap hari kerja.</CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <DailyAttendanceChart
              points={summary.daily.map((d) => ({
                label: String(d.date.getDate()),
                title: d.date.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "short", year: "numeric" }),
                onTime: d.onTime,
                late: d.late,
                leave: d.leave,
                absent: d.absent,
              }))}
            />
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader className="border-b">
              <CardTitle>Paling sering terlambat</CardTitle>
              <CardDescription>Jumlah hari terlambat & total menit.</CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
              <RankList
                color="var(--chart-4)"
                unit="kali"
                emptyMessage="Tidak ada keterlambatan bulan ini."
                items={summary.topLate.map((r) => ({
                  key: String(r.employeeId),
                  name: r.name,
                  sub: r.department,
                  count: r.count,
                  detail: durationLabel(r.minutes),
                  href: employeeHref(r.publicId),
                }))}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="border-b">
              <CardTitle>Paling sering tidak hadir</CardTitle>
              <CardDescription>Hari kerja tanpa tap dan tanpa izin.</CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
              <RankList
                color="var(--chart-8)"
                unit="hari"
                emptyMessage="Tidak ada ketidakhadiran tanpa keterangan bulan ini."
                items={summary.topAbsent.map((r) => ({
                  key: String(r.employeeId),
                  name: r.name,
                  sub: r.department,
                  count: r.count,
                  href: employeeHref(r.publicId),
                }))}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="border-b">
              <CardTitle>Paling sering pulang cepat</CardTitle>
              <CardDescription>Tap pulang sebelum jam pulang shift.</CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
              <RankList
                color="var(--chart-6)"
                unit="kali"
                emptyMessage="Tidak ada yang pulang cepat bulan ini."
                items={summary.topEarly.map((r) => ({
                  key: String(r.employeeId),
                  name: r.name,
                  sub: r.department,
                  count: r.count,
                  detail: durationLabel(r.minutes),
                  href: employeeHref(r.publicId),
                }))}
              />
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ── Tren 12 bulan ───────────────────────────────────── */}
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold tracking-wide text-muted-foreground uppercase">Tren 12 bulan</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="border-b">
              <CardTitle>Tingkat kehadiran per bulan</CardTitle>
              <CardDescription>Hari hadir dibanding hari kerja.</CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
              <ColumnSeriesChart
                color="var(--chart-1)"
                rows={trend.map((t) => ({
                  label: MONTHS[t.month],
                  title: `${MONTHS_LONG[t.month]} ${t.year}`,
                  value: t.rate,
                  display: t.rate === null ? "tidak ada hari kerja" : `${pct(t.rate)} (${t.present}/${t.expected} hari)`,
                }))}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="border-b">
              <CardTitle>Keterlambatan per bulan</CardTitle>
              <CardDescription>Jumlah hari terlambat seluruh pegawai.</CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
              <ColumnSeriesChart
                color="var(--chart-4)"
                emptyMessage="Tidak ada keterlambatan dalam 12 bulan."
                rows={trend.map((t) => ({
                  label: MONTHS[t.month],
                  title: `${MONTHS_LONG[t.month]} ${t.year}`,
                  value: t.late,
                  display: `${t.late} kali terlambat · ${t.absent} hari tidak hadir`,
                }))}
              />
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ── Pola & per bagian ───────────────────────────────── */}
      <section>
        <h2 className="mb-3 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          Pola · {MONTHS_LONG[month]} {year}
        </h2>
        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader className="border-b">
              <CardTitle>Kehadiran per bagian</CardTitle>
              <CardDescription>Tingkat kehadiran tiap bagian.</CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
              <PercentBars
                color="var(--chart-1)"
                rows={summary.departments.map((d) => ({
                  label: d.name,
                  value: d.rate,
                  detail: `${d.present}/${d.expected} hari · terlambat ${d.late} · tidak hadir ${d.absent}`,
                }))}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="border-b">
              <CardTitle>Keterlambatan per hari</CardTitle>
              <CardDescription>Persentase hadir yang terlambat, menurut hari.</CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
              <ColumnSeriesChart
                color="var(--chart-4)"
                height={130}
                emptyMessage="Belum ada data kehadiran."
                rows={summary.weekday.map((w) => ({
                  label: WEEKDAYS[w.weekday].slice(0, 3),
                  title: WEEKDAYS[w.weekday],
                  value: w.present ? w.late / w.present : 0,
                  display: `${w.late} dari ${w.present} kehadiran terlambat (${pct(w.present ? w.late / w.present : 0)})`,
                }))}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="border-b">
              <CardTitle>Jam kedatangan</CardTitle>
              <CardDescription>Sebaran jam tap masuk (per 15 menit).</CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
              <ColumnSeriesChart
                color="var(--chart-7)"
                height={130}
                emptyMessage="Belum ada data kedatangan."
                rows={summary.arrivals.map((a) => {
                  const label = `${String(Math.floor(a.minute / 60)).padStart(2, "0")}.${String(a.minute % 60).padStart(2, "0")}`
                  return { label, title: `Pukul ${label}–${hmFromMinutes(a.minute + 14)}`, value: a.count, display: `${a.count} kedatangan` }
                })}
              />
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  )
}

function hmFromMinutes(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}.${String(minutes % 60).padStart(2, "0")}`
}

function TodayList({
  title,
  description,
  empty,
  rows,
}: {
  title: string
  description: string
  empty: string
  rows: { key: number; name: string; sub: string; right: string; href?: string }[]
}) {
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center justify-between gap-2">
          {title}
          <span className="text-sm font-normal text-muted-foreground tabular-nums">{rows.length}</span>
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="pt-2">
        {rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{empty}</p>
        ) : (
          <ul className="grid max-h-72 gap-0.5 overflow-y-auto">
            {rows.map((r) => (
              <li key={r.key} className="flex items-center justify-between gap-3 rounded-md px-1.5 py-1.5 text-sm hover:bg-muted/50">
                <span className="min-w-0">
                  {r.href ? (
                    <Link href={r.href} className="block truncate font-medium hover:underline">
                      {r.name}
                    </Link>
                  ) : (
                    <span className="block truncate font-medium">{r.name}</span>
                  )}
                  <span className="block truncate text-xs text-muted-foreground">{r.sub}</span>
                </span>
                {r.right ? <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{r.right}</span> : null}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
