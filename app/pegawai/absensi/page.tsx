import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { getEmployeeAttendanceHistory } from "@/lib/employee-dashboard-stats"
import { Breadcrumb } from "@/components/breadcrumb"
import { AttendanceDateFilter } from "@/components/attendance-date-filter"
import { EmployeeAttendanceHistoryTable } from "@/components/employee-attendance-history-table"
import { ModuleBlueprintPage } from "@/components/module-blueprint-page"
import { CalendarClock } from "lucide-react"

function firstDayOfMonthValue() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`
}

function todayDateValue() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
}

function parseDateValue(value: string | undefined, fallback: string) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : fallback
}

export default async function PegawaiAbsensiPage({
  searchParams,
}: {
  searchParams: Promise<{ dari?: string; sampai?: string }>
}) {
  const session = await auth()
  const employee = session?.user.employeeId
    ? await prisma.employee.findUnique({
        where: { id: session.user.employeeId },
        select: { pinAttendance: true },
      })
    : null

  if (!employee?.pinAttendance) {
    return (
      <ModuleBlueprintPage
        breadcrumbItems={[
          { label: "Dashboard", href: "/pegawai/dashboard" },
          { label: "Riwayat Absensi" },
        ]}
        title="Riwayat Absensi"
        description="Rekap kehadiran Anda — jam masuk, jam pulang, dan status harian."
        icon={CalendarClock}
        plannedFeatures={[
          "Terhubung otomatis begitu PIN mesin fingerprint Anda dipetakan oleh admin",
          "Rekap hadir/terlambat/tidak hadir harian",
        ]}
      />
    )
  }

  const params = await searchParams
  const dari = parseDateValue(params.dari, firstDayOfMonthValue())
  const sampai = parseDateValue(params.sampai, todayDateValue())

  const start = new Date(`${dari}T00:00:00`)
  const end = new Date(`${sampai}T23:59:59.999`)

  const rows = await getEmployeeAttendanceHistory(employee.pinAttendance, { from: start, to: end })

  return (
    <div>
      <Breadcrumb
        items={[
          { label: "Dashboard", href: "/pegawai/dashboard" },
          { label: "Riwayat Absensi" },
        ]}
      />
      <h1 className="mb-1 text-2xl font-semibold">Riwayat Absensi</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Rekap kehadiran Anda dari mesin fingerprint — jam masuk, jam pulang, dan status harian.
      </p>
      <EmployeeAttendanceHistoryTable
        rows={rows}
        dateFilter={
          <AttendanceDateFilter
            key="employee-attendance-date-filter"
            initialFrom={dari}
            initialTo={sampai}
            basePath="/pegawai/absensi"
          />
        }
      />
    </div>
  )
}
