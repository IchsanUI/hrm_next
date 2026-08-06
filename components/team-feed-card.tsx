"use client"

import { useState, useTransition } from "react"
import { Bookmark, Heart, MessageCircle } from "lucide-react"

import type { TeamFeedRow } from "@/lib/team-feed"
import { formatFeedTime } from "@/lib/relative-time"
import { chartColor } from "@/lib/dashboard-palette"
import { cn } from "@/lib/utils"
import { createTeamFeedCommentAction, toggleEntryLikeAction } from "@/server/actions/team-feed"
import { TeamFeedCommentList } from "@/components/team-feed-comment-list"
import { TeamFeedComposer } from "@/components/team-feed-composer"
import { MentionText } from "@/components/mention-text"

// Avatar warna hash per nama — sama pola dengan components/dashboard-recent-activity.tsx.
function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? parts[0]?.[1] ?? "")).toUpperCase()
}

function avatarColor(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  return chartColor(hash)
}

const AUTO_EXPAND_WINDOW_MS = 60 * 60 * 1000

export function TeamFeedCard({
  row,
  mentionableNames,
}: {
  row: TeamFeedRow
  mentionableNames: string[]
}) {
  // Entri yang baru terjadi <1 jam lalu dan sudah ada komentar langsung
  // dibuka duluan — percakapan yang lagi "hangat" kelihatan tanpa perlu klik.
  // Dibungkus initializer function (bukan dihitung langsung di body render)
  // supaya Date.now() cuma dipanggil sekali saat mount, bukan tiap render.
  const [expanded, setExpanded] = useState(() => {
    const isFresh = Date.now() - row.occurredAt.getTime() < AUTO_EXPAND_WINDOW_MS
    return isFresh && row.commentCount > 0
  })
  const [commentCount, setCommentCount] = useState(row.commentCount)
  const [refreshKey, setRefreshKey] = useState(0)
  const [liked, setLiked] = useState(row.likedByMe)
  const [likeCount, setLikeCount] = useState(row.likeCount)
  const [isLiking, startLikeTransition] = useTransition()

  function handleLike() {
    // Optimis — dibalik lagi kalau server action gagal.
    const nextLiked = !liked
    setLiked(nextLiked)
    setLikeCount((c) => c + (nextLiked ? 1 : -1))
    startLikeTransition(async () => {
      const result = await toggleEntryLikeAction(row.requestKind, row.requestId)
      if (result.error || result.liked === undefined) {
        setLiked(!nextLiked)
        setLikeCount((c) => c + (nextLiked ? -1 : 1))
        return
      }
      setLiked(result.liked)
      setLikeCount(result.likeCount ?? 0)
    })
  }

  return (
    <div className="flex gap-3 border-b py-4 first:pt-0 last:border-b-0">
      {row.applicantPhotoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- foto internal, tidak perlu optimisasi next/image
        <img
          src={row.applicantPhotoUrl}
          alt={row.applicant}
          className="size-10 shrink-0 rounded-full object-cover"
        />
      ) : (
        <span
          className="flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
          style={{ backgroundColor: avatarColor(row.applicant) }}
        >
          {initials(row.applicant)}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-baseline gap-x-1.5 text-sm">
          <span className="font-semibold">{row.applicant}</span>
          <span className="text-muted-foreground" suppressHydrationWarning>
            · {formatFeedTime(row.occurredAt)}
          </span>
        </p>

        <div className="mt-0.5 text-sm text-foreground">
          {row.actionLabel ? <span className="text-muted-foreground">{row.actionLabel} </span> : null}
          {row.detail ? (
            <span className="break-words">
              <MentionText text={row.detail} names={mentionableNames} />
            </span>
          ) : null}
        </div>

        <div className="mt-2.5 flex items-center gap-5 text-muted-foreground">
          <button
            type="button"
            className={cn(
              "flex items-center gap-1.5 text-xs hover:text-foreground",
              liked && "text-destructive"
            )}
            onClick={handleLike}
            disabled={isLiking}
          >
            <Heart className={cn("size-4", liked && "fill-current")} />
            {likeCount > 0 ? likeCount : null}
          </button>
          <button
            type="button"
            className="flex items-center gap-1.5 text-xs hover:text-foreground"
            onClick={() => setExpanded((prev) => !prev)}
          >
            <MessageCircle className="size-4" />
            {commentCount > 0 ? commentCount : null}
          </button>
          <span className="flex items-center gap-1.5 text-xs opacity-40" aria-hidden>
            <Bookmark className="size-4" />
          </span>
        </div>

        {commentCount > 0 && !expanded ? (
          <button
            type="button"
            className="mt-2 text-xs font-medium text-primary hover:underline"
            onClick={() => setExpanded(true)}
          >
            Lihat {commentCount} balasan
          </button>
        ) : null}

        {expanded ? (
          <div className="mt-3 grid gap-3 border-t pt-3">
            <TeamFeedCommentList
              requestKind={row.requestKind}
              requestId={row.requestId}
              refreshKey={refreshKey}
              mentionableNames={mentionableNames}
            />
            <TeamFeedComposer
              action={createTeamFeedCommentAction.bind(null, row.requestKind, row.requestId)}
              placeholder="Tulis balasan... ketik @ untuk menyebut rekan"
              onPosted={() => {
                setCommentCount((c) => c + 1)
                setRefreshKey((k) => k + 1)
              }}
            />
          </div>
        ) : null}
      </div>
    </div>
  )
}
