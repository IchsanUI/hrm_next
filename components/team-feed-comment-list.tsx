"use client"

import { useEffect, useState, useTransition } from "react"
import { Heart } from "lucide-react"

import { getTeamFeedCommentsAction, toggleCommentLikeAction } from "@/server/actions/team-feed"
import { formatFeedTime } from "@/lib/relative-time"
import { chartColor } from "@/lib/dashboard-palette"
import { cn } from "@/lib/utils"
import { MentionText } from "@/components/mention-text"

type CommentRow = {
  id: number
  authorName: string
  authorPhotoUrl: string | null
  content: string
  createdAt: Date
  likeCount: number
  likedByMe: boolean
}

// Avatar warna hash per nama — pola sama seperti components/team-feed-card.tsx,
// supaya komentar terasa satu keluarga tampilan dengan entri feed utama
// (bukan bubble abu-abu tebal seperti sebelumnya).
function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? parts[0]?.[1] ?? "")).toUpperCase()
}

function avatarColor(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  return chartColor(hash)
}

function CommentLikeButton({ comment }: { comment: CommentRow }) {
  const [liked, setLiked] = useState(comment.likedByMe)
  const [likeCount, setLikeCount] = useState(comment.likeCount)
  const [isPending, startTransition] = useTransition()

  function handleClick() {
    const nextLiked = !liked
    setLiked(nextLiked)
    setLikeCount((c) => c + (nextLiked ? 1 : -1))
    startTransition(async () => {
      const result = await toggleCommentLikeAction(comment.id)
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
    <button
      type="button"
      className={cn(
        "flex items-center gap-1 text-[11px] hover:text-foreground",
        liked ? "text-destructive" : "text-muted-foreground"
      )}
      onClick={handleClick}
      disabled={isPending}
    >
      <Heart className={cn("size-3", liked && "fill-current")} />
      {likeCount > 0 ? likeCount : "Suka"}
    </button>
  )
}

export function TeamFeedCommentList({
  requestKind,
  requestId,
  refreshKey,
  mentionableNames,
}: {
  requestKind: string
  requestId: number
  refreshKey: number
  mentionableNames: string[]
}) {
  const [comments, setComments] = useState<CommentRow[] | null>(null)

  useEffect(() => {
    let cancelled = false
    getTeamFeedCommentsAction(requestKind, requestId).then((rows) => {
      if (!cancelled) setComments(rows)
    })
    return () => {
      cancelled = true
    }
  }, [requestKind, requestId, refreshKey])

  if (comments === null) {
    return <p className="text-xs text-muted-foreground">Memuat komentar...</p>
  }
  if (comments.length === 0) {
    return <p className="text-xs text-muted-foreground">Belum ada komentar.</p>
  }

  return (
    <div className="grid gap-3 border-l-2 pl-3">
      {comments.map((c) => (
        <div key={c.id} className="flex items-start gap-2">
          {c.authorPhotoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- foto internal, tidak perlu optimisasi next/image
            <img
              src={c.authorPhotoUrl}
              alt={c.authorName}
              className="size-7 shrink-0 rounded-full object-cover"
            />
          ) : (
            <span
              className="flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white"
              style={{ backgroundColor: avatarColor(c.authorName) }}
            >
              {initials(c.authorName)}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-baseline gap-x-1.5 text-xs">
              <span className="font-semibold">{c.authorName}</span>
              <span className="text-muted-foreground" suppressHydrationWarning>
                · {formatFeedTime(c.createdAt)}
              </span>
            </p>
            <p className="mt-0.5 text-sm break-words whitespace-pre-wrap">
              <MentionText text={c.content} names={mentionableNames} />
            </p>
            <div className="mt-1">
              <CommentLikeButton comment={c} />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
