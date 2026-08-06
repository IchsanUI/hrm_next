"use client"

import { useActionState, useEffect, useRef, useState, type FormEvent } from "react"
import { ArrowUp, AtSign, Image as ImageIcon, ListChecks, Smile } from "lucide-react"

import { getDepartmentColleaguesForMentionAction } from "@/server/actions/team-feed"
import { cn } from "@/lib/utils"
import { Textarea } from "@/components/ui/textarea"

type Colleague = { id: number; fullName: string }
type SelectedMention = { id: number; fullName: string }
type ComposerFormState = { error?: string } | undefined

// Set emoji terkurasi (bukan library pihak ketiga) — cukup buat kebutuhan
// reaksi/status update sehari-hari, tanpa nambah dependency baru.
const EMOJI_OPTIONS = [
  "😀", "😂", "😍", "🥳", "😎", "🤔", "😴", "😭",
  "👍", "🙏", "👏", "💪", "🔥", "🎉", "✅", "❤️",
  "☕", "🚀", "📌", "😅", "🙌", "😢", "😮", "🤝",
]

// Komponen generik dipakai buat DUA hal: komentar di satu entri (dibind ke
// createTeamFeedCommentAction dari TeamFeedCard, variant="comment") dan post
// bebas ("status update") di bagian atas feed (dibind ke createTeamFeedPostAction
// dari halaman Ruang Tim, variant="post") — bedanya cuma action yang di-bind,
// placeholder, dan tampilan (post punya toolbar ikon dekoratif ala medsos).
export function TeamFeedComposer({
  action: createAction,
  placeholder = "Tulis komentar... ketik @ untuk menyebut rekan",
  onPosted,
  variant = "comment",
}: {
  action: (
    mentionedEmployeeIds: number[],
    prevState: ComposerFormState,
    formData: FormData
  ) => Promise<ComposerFormState>
  placeholder?: string
  onPosted?: () => void
  variant?: "post" | "comment"
}) {
  const [content, setContent] = useState("")
  const [colleagues, setColleagues] = useState<Colleague[]>([])
  const [mentions, setMentions] = useState<SelectedMention[]>([])
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    getDepartmentColleaguesForMentionAction().then(setColleagues).catch(() => setColleagues([]))
  }, [])

  const action = createAction.bind(null, mentions.map((m) => m.id))
  const [state, formAction, isPending] = useActionState(action, undefined)
  const wasPending = useRef(false)

  useEffect(() => {
    if (!wasPending.current || isPending) {
      wasPending.current = isPending
      return
    }
    wasPending.current = isPending
    if (!state?.error) {
      const id = setTimeout(() => {
        setContent("")
        setMentions([])
        setShowEmojiPicker(false)
        onPosted?.()
      }, 0)
      return () => clearTimeout(id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPending, state])

  function handleChange(e: FormEvent<HTMLTextAreaElement>) {
    const value = e.currentTarget.value
    setContent(value)
    const caret = e.currentTarget.selectionStart ?? value.length
    const beforeCaret = value.slice(0, caret)
    const match = beforeCaret.match(/@([\w ]*)$/)
    setMentionQuery(match ? match[1] : null)
  }

  function pickMention(colleague: Colleague) {
    const caret = textareaRef.current?.selectionStart ?? content.length
    const beforeCaret = content.slice(0, caret)
    const afterCaret = content.slice(caret)
    const replaced = beforeCaret.replace(/@([\w ]*)$/, `@${colleague.fullName} `)
    setContent(replaced + afterCaret)
    setMentions((prev) => (prev.some((m) => m.id === colleague.id) ? prev : [...prev, colleague]))
    setMentionQuery(null)
    textareaRef.current?.focus()
  }

  function insertAtSign() {
    setContent((prev) => (prev.endsWith(" ") || prev === "" ? `${prev}@` : `${prev} @`))
    setMentionQuery("")
    textareaRef.current?.focus()
  }

  function insertEmoji(emoji: string) {
    const caret = textareaRef.current?.selectionStart ?? content.length
    const beforeCaret = content.slice(0, caret)
    const afterCaret = content.slice(caret)
    setContent(`${beforeCaret}${emoji}${afterCaret}`)
    setShowEmojiPicker(false)
    textareaRef.current?.focus()
  }

  const filteredColleagues =
    mentionQuery !== null
      ? colleagues.filter((c) => c.fullName.toLowerCase().includes(mentionQuery.toLowerCase()))
      : []
  const canSubmit = !isPending && content.trim().length > 0

  return (
    <form
      action={formAction}
      className={cn(
        "relative grid gap-2",
        variant === "post" && "rounded-2xl border bg-card p-3"
      )}
    >
      <div className="relative">
        <Textarea
          ref={textareaRef}
          name="content"
          value={content}
          onChange={handleChange}
          placeholder={placeholder}
          maxLength={1000}
          className={cn(
            variant === "post"
              ? "min-h-10 resize-none border-none bg-transparent px-0 shadow-none focus-visible:ring-0"
              : "min-h-14 text-sm"
          )}
        />
        {mentionQuery !== null && filteredColleagues.length > 0 ? (
          <div className="absolute top-full left-0 z-10 mt-1 w-full max-w-xs rounded-lg border bg-popover p-1 shadow-md">
            {filteredColleagues.slice(0, 6).map((c) => (
              <button
                key={c.id}
                type="button"
                className="block w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                onClick={() => pickMention(c)}
              >
                {c.fullName}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      {state?.error ? <p className="text-xs text-destructive">{state.error}</p> : null}

      {variant === "post" ? (
        <div className="flex items-center justify-between border-t pt-2.5">
          <div className="relative flex items-center gap-1 text-muted-foreground">
            <button
              type="button"
              onClick={insertAtSign}
              className="rounded-full p-1.5 hover:bg-muted hover:text-foreground"
              aria-label="Sebut rekan"
            >
              <AtSign className="size-4" />
            </button>
            <span className="rounded-full p-1.5 opacity-40" aria-hidden>
              <ImageIcon className="size-4" />
            </span>
            <span className="rounded-full p-1.5 opacity-40" aria-hidden>
              <ListChecks className="size-4" />
            </span>
            <button
              type="button"
              onClick={() => setShowEmojiPicker((prev) => !prev)}
              className={cn(
                "rounded-full p-1.5 hover:bg-muted hover:text-foreground",
                showEmojiPicker && "bg-muted text-foreground"
              )}
              aria-label="Sisipkan emoji"
            >
              <Smile className="size-4" />
            </button>
            {showEmojiPicker ? (
              <div className="absolute bottom-full left-0 z-10 mb-1 grid w-56 grid-cols-8 gap-1 rounded-lg border bg-popover p-2 shadow-md">
                {EMOJI_OPTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    className="rounded p-1 text-lg hover:bg-muted"
                    onClick={() => insertEmoji(emoji)}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <button
            type="submit"
            disabled={!canSubmit}
            aria-label="Posting"
            className="flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity disabled:opacity-40"
          >
            <ArrowUp className="size-4" />
          </button>
        </div>
      ) : (
        <div className="relative flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={() => setShowEmojiPicker((prev) => !prev)}
            className={cn(
              "rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground",
              showEmojiPicker && "bg-muted text-foreground"
            )}
            aria-label="Sisipkan emoji"
          >
            <Smile className="size-4" />
          </button>
          {showEmojiPicker ? (
            <div className="absolute bottom-full right-0 z-10 mb-1 grid w-56 grid-cols-8 gap-1 rounded-lg border bg-popover p-2 shadow-md">
              {EMOJI_OPTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  className="rounded p-1 text-lg hover:bg-muted"
                  onClick={() => insertEmoji(emoji)}
                >
                  {emoji}
                </button>
              ))}
            </div>
          ) : null}
          <button
            type="submit"
            disabled={!canSubmit}
            aria-label="Kirim komentar"
            className="flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity disabled:opacity-40"
          >
            <ArrowUp className="size-3.5" />
          </button>
        </div>
      )}
    </form>
  )
}
