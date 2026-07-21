import { prisma } from "@/lib/prisma"
import { Breadcrumb } from "@/components/breadcrumb"
import { AttendanceLogTable, type AttendanceLogRow } from "@/components/attendance-log-table"
import { AttendanceDateFilter } from "@/components/attendance-date-filter"
import { AttendanceSyncButton } from "@/components/attendance-sync-button"
import { formatRelativeTime } from "@/lib/relative-time"

function todayDateValue() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
}

function parseDateValue(value: string | undefined, fallback: string) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : fallback
}

export default async function DataAbsensiPage({
  searchParams,
}: {
  searchParams: Promise<{ dari?: string; sampai?: string }>
}) {
  const params = await searchParams
  const today = todayDateValue()
  const dari = parseDateValue(params.dari, today)
  const sampai = parseDateValue(params.sampai, today)

  const start = new Date(`${dari}T00:00:00`)
  const end = new Date(`${sampai}T23:59:59.999`)

  const [logs, lastSync] = await Promise.all([
    prisma.attendanceLog.findMany({
      where: { logTime: { gte: start, lte: end } },
      orderBy: { logTime: "desc" },
      take: 1000,
    }),
    prisma.attendanceLog.aggregate({ _max: { syncedAt: true } }),
  ])
  const lastSyncedAt = lastSync._max.syncedAt

  const pins = Array.from(new Set(logs.map((l) => l.userPin)))
  const employees =
    pins.length > 0
      ? await prisma.employee.findMany({
          where: { pinAttendance: { in: pins } },
          select: { pinAttendance: true, fullName: true },
        })
      : []
  const employeeByPin = new Map(employees.map((e) => [e.pinAttendance as string, e.fullName]))

  const rows: AttendanceLogRow[] = logs
    .map((l) => ({
      id: l.id,
      userPin: l.userPin,
      name: l.name,
      location: l.location,
      logTime: l.logTime,
      verifyType: l.verifyType,
      logType: l.logType,
      note: l.note,
      employeeName: employeeByPin.get(l.userPin) ?? null,
    }))
    .sort((a, b) =>
      (a.employeeName ?? a.name).localeCompare(b.employeeName ?? b.name, "id-ID")
    )

  return (
    <div>
      <Breadcrumb
        items={[
          { label: "Dashboard", href: "/admin/dashboard" },
          { label: "Absensi" },
          { label: "Data Absensi" },
        ]}
      />
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Data Absensi</h1>
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-xs text-muted-foreground">
            {lastSyncedAt
              ? `Terakhir diambil: ${formatRelativeTime(lastSyncedAt)} (${lastSyncedAt.toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })})`
              : "Belum pernah diambil datanya."}
          </p>
          <AttendanceSyncButton />
        </div>
      </div>
      <p className="mb-6 text-sm text-muted-foreground">
        Menampilkan data absensi hari ini. Baris &quot;Belum terhubung&quot; berarti PIN belum
        dipetakan ke pegawai di halaman Data Pegawai.
      </p>
      <AttendanceLogTable
        rows={rows}
        dateFilter={
          <AttendanceDateFilter key="attendance-date-filter" initialFrom={dari} initialTo={sampai} />
        }
      />
    </div>
  )
}
