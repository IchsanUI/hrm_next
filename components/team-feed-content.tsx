"use client"

import { useState, useTransition } from "react"

import type { TeamFeedRow, TeamFeedCursor, TeamFeedKindFilter } from "@/lib/team-feed"
import { defaultFeedSinceDate, FEED_DEFAULT_WINDOW_DAYS } from "@/lib/team-feed-window"
import { createTeamFeedPostAction, loadMoreTeamFeedAction } from "@/server/actions/team-feed"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { TeamFeedCard } from "@/components/team-feed-card"
import { TeamFeedComposer } from "@/components/team-feed-composer"

const TABS: { value: TeamFeedKindFilter; label: string }[] = [
  { value: "all", label: "Semua" },
  { value: "izin", label: "Izin" },
  { value: "post", label: "Post" },
]

export function TeamFeedContent({
  initialRows,
  initialCursor,
  mentionableNames,
}: {
  initialRows: TeamFeedRow[]
  initialCursor: TeamFeedCursor
  mentionableNames: string[]
}) {
  const [rows, setRows] = useState(initialRows)
  const [cursor, setCursor] = useState(initialCursor)
  const [kindFilter, setKindFilter] = useState<TeamFeedKindFilter>("all")
  // true = query dibatasi FEED_DEFAULT_WINDOW_DAYS hari terakhir (default),
  // false = "Tampilkan semua waktu" sudah diklik, tanpa batas tanggal.
  const [windowed, setWindowed] = useState(true)
  const [isPending, startTransition] = useTransition()

  function sinceDate() {
    return windowed ? defaultFeedSinceDate() : null
  }

  function handleLoadMore() {
    startTransition(async () => {
      const next = await loadMoreTeamFeedAction(cursor, kindFilter, sinceDate())
      setRows((prev) => [...prev, ...next.rows])
      setCursor(next.nextCursor)
    })
  }

  // Reset paginasi dari halaman pertama — dipakai setelah post baru, ganti
  // tab filter, atau klik "Tampilkan semua waktu".
  function reload(nextKindFilter: TeamFeedKindFilter, nextWindowed: boolean) {
    startTransition(async () => {
      const since = nextWindowed ? defaultFeedSinceDate() : null
      const first = await loadMoreTeamFeedAction(null, nextKindFilter, since)
      setRows(first.rows)
      setCursor(first.nextCursor)
    })
  }

  function handleTabChange(tab: TeamFeedKindFilter) {
    setKindFilter(tab)
    reload(tab, windowed)
  }

  function handleShowAllTime() {
    setWindowed(false)
    reload(kindFilter, false)
  }

  function handlePosted() {
    reload(kindFilter, windowed)
  }

  return (
    <div className="grid gap-4">
      <TeamFeedComposer
        action={createTeamFeedPostAction}
        placeholder="Bagikan sesuatu ke tim..."
        onPosted={handlePosted}
        variant="post"
      />

      <div className="flex items-center gap-1 border-b">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => handleTabChange(tab.value)}
            className={cn(
              "border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              kindFilter === tab.value
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="grid gap-2 rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          <p>
            {windowed
              ? `Belum ada aktivitas dalam ${FEED_DEFAULT_WINDOW_DAYS} hari terakhir.`
              : "Belum ada aktivitas di departemen ini."}
          </p>
          {windowed ? (
            <button
              type="button"
              className="mx-auto text-xs font-medium text-primary hover:underline"
              onClick={handleShowAllTime}
            >
              Tampilkan semua waktu
            </button>
          ) : null}
        </div>
      ) : (
        <div>
          <div>
            {rows.map((row) => (
              <TeamFeedCard
                key={`${row.requestKind}-${row.requestId}`}
                row={row}
                mentionableNames={mentionableNames}
              />
            ))}
          </div>
          <div className="flex flex-col items-center gap-2 pt-3">
            {cursor ? (
              <Button type="button" variant="outline" onClick={handleLoadMore} disabled={isPending}>
                {isPending ? "Memuat..." : "Muat lebih banyak"}
              </Button>
            ) : windowed ? (
              <button
                type="button"
                className="text-xs font-medium text-primary hover:underline"
                onClick={handleShowAllTime}
                disabled={isPending}
              >
                Tampilkan aktivitas lebih dari {FEED_DEFAULT_WINDOW_DAYS} hari lalu
              </button>
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}
