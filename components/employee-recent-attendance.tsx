import { Fingerprint, MapPin } from "lucide-react"

import type { EmployeeAttendanceRow } from "@/lib/employee-dashboard-stats"

function formatDate(date: Date) {
  return date.toLocaleDateString("id-ID", { day: "2-digit", month: "short" })
}

function formatTime(date: Date) {
  return date.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
}

export function EmployeeRecentAttendance({ rows }: { rows: EmployeeAttendanceRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Belum ada data absensi tercatat dari mesin fingerprint.
      </p>
    )
  }

  return (
    <div className="grid gap-1">
      {rows.map((row) => (
        <div
          key={row.id}
          className="flex items-center gap-3 rounded-lg px-1.5 py-2 transition-colors hover:bg-muted/60"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
            <Fingerprint className="size-4.5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{formatDate(row.logTime)}</p>
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="size-3" />
              {row.location} · {row.verifyType}
            </p>
          </div>
          <span className="shrink-0 text-lg font-semibold tabular-nums">
            {formatTime(row.logTime)}
          </span>
        </div>
      ))}
    </div>
  )
}
