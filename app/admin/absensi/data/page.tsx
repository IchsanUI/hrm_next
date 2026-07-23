import { prisma } from "@/lib/prisma"
import { Breadcrumb } from "@/components/breadcrumb"
import { AttendanceLogTable, type AttendanceDayRow } from "@/components/attendance-log-table"
import { AttendanceDateFilter } from "@/components/attendance-date-filter"
import { AttendanceSyncButton } from "@/components/attendance-sync-button"
import { formatRelativeTime } from "@/lib/relative-time"
import { dateKey, summarizeDayTaps } from "@/lib/attendance/day-summary"

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

  // Batas atas jaga-jaga (bukan buat "halaman pertama" seperti sebelumnya —
  // itu bug: take:1000 diurutkan DESC ikut memotong tanggal lama duluan
  // kalau rentangnya luas, bikin data lama seperti "hilang". Sekarang
  // rentang tanggal ITU SENDIRI yang membatasi jumlah baris; batas ini
  // cuma pengaman kalau rentangnya dibuat sangat luas.
  const MAX_ROWS = 20000
  const [logs, lastSync] = await Promise.all([
    prisma.attendanceLog.findMany({
      where: { logTime: { gte: start, lte: end } },
      orderBy: { logTime: "asc" }, // ASC wajib — summarizeDayTaps butuh urutan tap dari yang paling awal
      take: MAX_ROWS,
      select: { userPin: true, name: true, location: true, logTime: true },
    }),
    prisma.attendanceLog.aggregate({ _max: { syncedAt: true } }),
  ])
  const truncated = logs.length === MAX_ROWS
  const lastSyncedAt = lastSync._max.syncedAt

  const pins = Array.from(new Set(logs.map((l) => l.userPin)))
  const employees =
    pins.length > 0
      ? await prisma.employee.findMany({
          where: { pinAttendance: { in: pins } },
          select: {
            pinAttendance: true,
            fullName: true,
            workShift: { select: { checkInTime: true, checkOutTime: true } },
          },
        })
      : []
  const employeeByPin = new Map(employees.map((e) => [e.pinAttendance as string, e]))

  // Dikelompokkan per (PIN + tanggal) — satu tap-tap-an di hari yang sama
  // jadi satu baris, sama seperti Riwayat Absensi pegawai (lihat
  // lib/attendance/day-summary.ts).
  const grouped = new Map<string, typeof logs>()
  for (const log of logs) {
    const key = `${log.userPin}|${dateKey(log.logTime)}`
    const arr = grouped.get(key)
    if (arr) arr.push(log)
    else grouped.set(key, [log])
  }

  const rows: AttendanceDayRow[] = Array.from(grouped.values())
    .map((dayLogs) => {
      const pin = dayLogs[0].userPin
      const employee = employeeByPin.get(pin)
      const summary = summarizeDayTaps(dayLogs, employee?.workShift ?? null)
      return {
        userPin: pin,
        name: dayLogs[0].name,
        employeeName: employee?.fullName ?? null,
        date: summary.checkIn,
        location: dayLogs[0].location,
        ...summary,
      }
    })
    .sort((a, b) => {
      const nameCompare = (a.employeeName ?? a.name).localeCompare(b.employeeName ?? b.name, "id-ID")
      if (nameCompare !== 0) return nameCompare
      return b.date.getTime() - a.date.getTime()
    })

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
        Baris &quot;Belum terhubung&quot; berarti PIN belum dipetakan ke pegawai di
        halaman Data Pegawai. Status Terlambat/Pulang Cepat butuh Jam Kerja pegawai
        sudah diatur di Data Pegawai.
        {truncated ? (
          <span className="mt-1 block text-amber-600">
            Rentang tanggal ini punya lebih dari {MAX_ROWS.toLocaleString("id-ID")} baris log —
            hanya baris terbaru yang ditampilkan. Persempit rentang tanggal untuk melihat semua data.
          </span>
        ) : null}
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
