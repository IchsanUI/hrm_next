import { LogIn, LogOut, MapPin } from "lucide-react"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import type { EmployeeAttendanceDayRow, EmployeeAttendanceStatus } from "@/lib/employee-dashboard-stats"

const STATUS_LABEL: Record<EmployeeAttendanceStatus, string> = {
  TERLAMBAT: "Terlambat",
  PULANG_CEPAT: "Pulang Cepat",
  TEPAT_WAKTU: "Tepat waktu",
  TIDAK_ADA_JAM_KERJA: "Jam kerja belum diatur",
}

function formatDate(date: Date) {
  return date.toLocaleDateString("id-ID", { weekday: "short", day: "2-digit", month: "short" })
}

function formatTime(date: Date) {
  return date.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
}

function StatusBadges({ statuses }: { statuses: EmployeeAttendanceStatus[] }) {
  return (
    <div className="flex flex-wrap justify-end gap-1">
      {statuses.map((status) => (
        <Badge
          key={status}
          variant="outline"
          className={cn(
            "text-xs",
            status === "TERLAMBAT" || status === "PULANG_CEPAT"
              ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-400"
              : "text-muted-foreground"
          )}
        >
          {STATUS_LABEL[status]}
        </Badge>
      ))}
    </div>
  )
}

// Jam + lokasi tap-nya SATU blok — pegawai kadang tap di lokasi beda pagi
// vs sore (mis. masuk di Pusat, pulang di KAS), jadi lokasinya ditempel
// langsung ke jam yang bersangkutan, bukan satu lokasi buat seluruh hari.
function TimeWithLocation({
  icon: Icon,
  time,
  location,
  tint,
}: {
  icon: typeof LogIn
  time: string
  location: string | null
  tint: string
}) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
      <Icon className={cn("size-3.5 shrink-0", tint)} />
      <span className="shrink-0 text-sm font-semibold tabular-nums">{time}</span>
      {location ? (
        <span className="flex min-w-0 items-center gap-0.5 text-xs text-muted-foreground">
          <MapPin className="size-3 shrink-0" />
          <span className="truncate">{location}</span>
        </span>
      ) : null}
    </div>
  )
}

export function EmployeeRecentAttendance({ rows }: { rows: EmployeeAttendanceDayRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Belum ada data absensi tercatat dari mesin fingerprint.
      </p>
    )
  }

  return (
    <div className="grid max-h-[26rem] gap-1 overflow-y-auto pr-1">
      {rows.map((row, index) => (
        <div
          key={index}
          className="rounded-lg px-1.5 py-2.5 transition-colors hover:bg-muted/60"
        >
          {/* Mobile (<sm): ditumpuk 2 baris — kolom grid 4-in-a-row versi
              desktop kepepet jadi terlalu sempit di layar HP, angka jamnya
              sampai ke-crop (mis. "07.10" kepotong jadi "07.1"). Baris 1:
              tanggal + status. Baris 2: jam masuk & pulang berdampingan,
              masing-masing dapat separuh lebar penuh, bukan 1fr yang
              diperas 4 kolom sekaligus. */}
          <div className="flex flex-col gap-1.5 sm:hidden">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">{formatDate(row.date)}</p>
              <StatusBadges statuses={row.statuses} />
            </div>
            <div className="flex items-center gap-4">
              <TimeWithLocation
                icon={LogIn}
                time={formatTime(row.checkIn)}
                location={row.checkInLocation}
                tint="text-blue-600 dark:text-blue-400"
              />
              <TimeWithLocation
                icon={LogOut}
                time={row.checkOut ? formatTime(row.checkOut) : "-"}
                location={row.checkOutLocation}
                tint="text-muted-foreground"
              />
            </div>
          </div>

          {/* Desktop (sm+): satu baris 4 kolom seperti semula, cukup lebar. */}
          <div className="hidden sm:grid sm:grid-cols-[5.5rem_1fr_1fr_auto] sm:items-center sm:gap-3">
            <p className="shrink-0 text-sm font-medium">{formatDate(row.date)}</p>

            <TimeWithLocation
              icon={LogIn}
              time={formatTime(row.checkIn)}
              location={row.checkInLocation}
              tint="text-blue-600 dark:text-blue-400"
            />

            <TimeWithLocation
              icon={LogOut}
              time={row.checkOut ? formatTime(row.checkOut) : "-"}
              location={row.checkOutLocation}
              tint="text-muted-foreground"
            />

            <StatusBadges statuses={row.statuses} />
          </div>
        </div>
      ))}
    </div>
  )
}
