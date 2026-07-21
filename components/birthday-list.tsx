import { cn } from "@/lib/utils"
import type { BirthdayRow } from "@/lib/dashboard-stats"

export function BirthdayList({
  birthdays,
  today,
}: {
  birthdays: BirthdayRow[]
  today: number
}) {
  if (birthdays.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Tidak ada pegawai yang berulang tahun bulan ini.
      </p>
    )
  }

  return (
    <div className="grid gap-1">
      {birthdays.map((b) => {
        const isToday = b.birthDay === today
        return (
          <div
            key={b.id}
            className="flex items-center gap-3 rounded-lg px-1.5 py-1.5 transition-colors hover:bg-muted/60"
          >
            <div
              className={cn(
                "flex size-9 shrink-0 flex-col items-center justify-center rounded-full text-xs leading-none font-semibold tabular-nums",
                isToday
                  ? "bg-rose-500 text-white"
                  : "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400"
              )}
            >
              {String(b.birthDay).padStart(2, "0")}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{b.fullName}</p>
              <p className="truncate text-xs text-muted-foreground">
                {b.positionName} · {b.departmentName}
              </p>
            </div>
            <span className="shrink-0 text-xs text-muted-foreground">{b.turningAge} th</span>
          </div>
        )
      })}
    </div>
  )
}
