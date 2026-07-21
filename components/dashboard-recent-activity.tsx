import Link from "next/link"

import { chartColor } from "@/lib/dashboard-palette"
import { ACTION_LABEL } from "@/components/activity-log-table"
import type { RecentActivityRow } from "@/lib/dashboard-stats"

function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? parts[0]?.[1] ?? "")).toUpperCase()
}

// Warna avatar konsisten per username (hash sederhana → index palet
// kategorikal tetap), bukan diacak per render.
function avatarColor(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  return chartColor(hash)
}

function formatTime(date: Date) {
  return date.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
}

function dayKey(date: Date) {
  return date.toDateString()
}

function dayLabel(date: Date, now: Date) {
  if (dayKey(date) === dayKey(now)) return "Hari Ini"
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (dayKey(date) === dayKey(yesterday)) return "Kemarin"
  return date.toLocaleDateString("id-ID", { day: "2-digit", month: "long" })
}

export function DashboardRecentActivity({ logs }: { logs: RecentActivityRow[] }) {
  if (logs.length === 0) {
    return <p className="text-sm text-muted-foreground">Belum ada aktivitas tercatat.</p>
  }

  const now = new Date()
  const items = logs.map((log, i) => ({
    log,
    showDivider: i === 0 || dayKey(log.createdAt) !== dayKey(logs[i - 1].createdAt),
  }))

  return (
    <div>
      <div className="grid gap-1">
        {items.map(({ log, showDivider }) => {
          return (
            <div key={log.id}>
              {showDivider ? (
                <div className="my-2 flex items-center gap-3 first:mt-0">
                  <span className="h-px flex-1 bg-border" />
                  <span className="text-xs font-medium text-muted-foreground">
                    {dayLabel(log.createdAt, now)}
                  </span>
                  <span className="h-px flex-1 bg-border" />
                </div>
              ) : null}

              <div className="flex gap-3 rounded-lg px-1.5 py-2 transition-colors hover:bg-muted/60">
                <span
                  className="flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                  style={{ backgroundColor: avatarColor(log.username) }}
                >
                  {initials(log.username)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm">
                    <span className="font-medium">{log.username}</span>{" "}
                    <span className="text-muted-foreground">
                      {(ACTION_LABEL[log.action] ?? log.action).toLowerCase()}
                    </span>
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formatTime(log.createdAt)}
                  </p>
                  <p className="mt-1.5 rounded-lg bg-muted px-2.5 py-1.5 text-xs break-words text-foreground">
                    {log.description}
                  </p>
                </div>
              </div>
            </div>
          )
        })}
      </div>
      <Link
        href="/admin/log-aktivitas"
        className="mt-2 inline-block px-1.5 text-sm font-medium text-primary hover:underline"
      >
        Lihat semua aktivitas →
      </Link>
    </div>
  )
}
