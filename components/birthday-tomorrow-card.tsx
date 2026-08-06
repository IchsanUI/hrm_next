import { Cake } from "lucide-react"

import type { BirthdayTomorrowRow } from "@/lib/dashboard-stats"
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card"

function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? parts[0]?.[1] ?? "")).toUpperCase()
}

export function BirthdayTomorrowCard({
  birthdays,
  viewerEmployeeId,
}: {
  birthdays: BirthdayTomorrowRow[]
  viewerEmployeeId: number
}) {
  if (birthdays.length === 0) return null

  return (
    <Card className="animate-in fade-in slide-in-from-top-2 gap-0 border-rose-200 bg-gradient-to-r from-rose-100 via-pink-50 to-rose-100 py-4 duration-500 dark:border-rose-500/20 dark:from-rose-500/10 dark:via-rose-500/5 dark:to-rose-500/10">
      <CardContent className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-rose-500 text-white shadow-sm">
            <Cake className="size-5 animate-bounce [animation-duration:1.5s]" />
          </span>
          <div>
            <CardTitle>Ulang Tahun Besok</CardTitle>
            <CardDescription>Jangan lupa ucapkan selamat ya!</CardDescription>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {birthdays.map((b) => {
            // Kalau yang lagi login adalah orang yang besok ulang tahun,
            // jangan tampilkan namanya sendiri ke dia — rekan lain tetap
            // lihat nama & umurnya di dashboard masing-masing.
            const isSelf = b.id === viewerEmployeeId
            return (
              <div
                key={b.id}
                className="flex items-center gap-2 rounded-full bg-white/70 py-1 pr-3 pl-1 shadow-sm transition-colors hover:bg-white dark:bg-rose-500/10 dark:hover:bg-rose-500/15"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-rose-500 text-xs font-semibold text-white">
                  {isSelf ? <Cake className="size-4" /> : initials(b.fullName)}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium">{isSelf ? "Anda" : b.fullName}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {isSelf ? "Selamat ulang tahun besok!" : `${b.turningAge} tahun 🎉`}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
