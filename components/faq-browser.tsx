"use client"

import { Fragment, useMemo, useState } from "react"
import Link from "next/link"
import {
  Archive,
  ArrowRight,
  BookOpen,
  Building2,
  Car,
  CarFront,
  ClipboardList,
  CalendarCog,
  ChevronDown,
  ClipboardCheck,
  DatabaseBackup,
  FilePlus2,
  Fingerprint,
  Gauge,
  HardDrive,
  HeartPulse,
  Info,
  KeyRound,
  MessageSquareWarning,
  ReceiptText,
  Search,
  SearchX,
  ShieldCheck,
  UserCog,
  UserRound,
  Users2,
  Wallet,
  type LucideIcon,
} from "lucide-react"

import { cn } from "@/lib/utils"
import {
  FAQ_AUDIENCE_LABEL,
  type FaqAudience,
  type FaqBlock,
  type FaqIcon,
  type FaqItem,
  type FaqTopic,
} from "@/lib/faq-content"
import { Input } from "@/components/ui/input"

const ICONS: Record<FaqIcon, LucideIcon> = {
  account: KeyRound,
  attendance: Fingerprint,
  leave: FilePlus2,
  approval: ClipboardCheck,
  payslip: ReceiptText,
  profile: UserRound,
  team: Users2,
  library: BookOpen,
  issue: MessageSquareWarning,
  employees: Building2,
  leaveAdmin: CalendarCog,
  payroll: Wallet,
  health: HeartPulse,
  access: ShieldCheck,
  users: UserCog,
  monitoring: Gauge,
  storage: HardDrive,
  backup: DatabaseBackup,
  archive: Archive,
  vehicle: Car,
  vehicleStaff: ClipboardList,
  driver: CarFront,
}

// **tebal** → <strong>. Sengaja sederhana: tidak ada HTML mentah, jadi aman.
function RichText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("**") && part.endsWith("**") ? (
          <strong key={i} className="font-semibold text-foreground">
            {part.slice(2, -2)}
          </strong>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        )
      )}
    </>
  )
}

function Block({ block }: { block: FaqBlock }) {
  if (typeof block === "string") {
    return (
      <p>
        <RichText text={block} />
      </p>
    )
  }
  if ("list" in block) {
    return (
      <ul className="grid list-disc gap-1 pl-5">
        {block.list.map((item, i) => (
          <li key={i}>
            <RichText text={item} />
          </li>
        ))}
      </ul>
    )
  }
  if ("steps" in block) {
    return (
      <ol className="grid gap-2">
        {block.steps.map((step, i) => (
          <li key={i} className="flex gap-2.5">
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary tabular-nums">
              {i + 1}
            </span>
            <span>
              <RichText text={step} />
            </span>
          </li>
        ))}
      </ol>
    )
  }
  if ("note" in block) {
    return (
      <p className="flex gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
        <Info className="mt-0.5 size-4 shrink-0" />
        <span>
          <RichText text={block.note} />
        </span>
      </p>
    )
  }
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-left text-sm">
        <thead className="bg-muted/60 text-xs text-muted-foreground">
          <tr>
            {block.table.head.map((h) => (
              <th key={h} className="px-3 py-2 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {block.table.rows.map(([a, b]) => (
            <tr key={a}>
              <td className="px-3 py-2 font-medium text-foreground">{a}</td>
              <td className="px-3 py-2">{b}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function blockText(block: FaqBlock): string {
  if (typeof block === "string") return block
  if ("list" in block) return block.list.join(" ")
  if ("steps" in block) return block.steps.join(" ")
  if ("note" in block) return block.note
  return block.table.rows.flat().join(" ")
}

function matches(item: FaqItem, q: string) {
  return (item.q + " " + item.a.map(blockText).join(" ")).toLowerCase().replace(/\*\*/g, "").includes(q)
}

// Hasil pencarian tampil terbuka; saat menjelajah, tertutup sampai diklik.
function QuestionRow({ item, open }: { item: FaqItem; open: boolean }) {
  return (
    <details className="group border-b last:border-b-0" open={open || undefined}>
      <summary className="flex cursor-pointer list-none items-start justify-between gap-3 px-4 py-3.5 text-sm font-medium transition-colors hover:bg-muted/50 [&::-webkit-details-marker]:hidden">
        <span>{item.q}</span>
        <ChevronDown className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="grid gap-3 px-4 pb-4 text-sm leading-relaxed text-muted-foreground">
        {item.a.map((block, i) => (
          <Block key={i} block={block} />
        ))}
      </div>
    </details>
  )
}

export function FaqBrowser({ topics }: { topics: FaqTopic[] }) {
  const [query, setQuery] = useState("")
  const [activeTopic, setActiveTopic] = useState<string>("ALL")

  const audiences = useMemo(
    () => (["pegawai", "petugas", "admin", "superadmin"] as FaqAudience[]).filter((a) => topics.some((t) => t.audience === a)),
    [topics]
  )
  const showAudience = audiences.length > 1

  const q = query.trim().toLowerCase()
  const visible = useMemo(() => {
    return topics
      .filter((t) => activeTopic === "ALL" || t.id === activeTopic)
      .map((t) => ({ ...t, items: q ? t.items.filter((item) => matches(item, q)) : t.items }))
      .filter((t) => t.items.length > 0)
  }, [topics, activeTopic, q])
  const resultCount = visible.reduce((sum, t) => sum + t.items.length, 0)

  return (
    <div className="grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)] lg:items-start">
      <aside className="grid gap-4 lg:sticky lg:top-4">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari pertanyaan…"
            className="pl-8"
            aria-label="Cari pertanyaan"
          />
        </div>
        <nav className="flex gap-1.5 overflow-x-auto pb-1 lg:grid lg:gap-0.5 lg:overflow-visible lg:pb-0">
          <TopicButton active={activeTopic === "ALL"} onClick={() => setActiveTopic("ALL")} label="Semua Topik" />
          {audiences.map((audience) => (
            <Fragment key={audience}>
              {showAudience ? (
                <p className="hidden px-2.5 pt-3 pb-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase lg:block">
                  {FAQ_AUDIENCE_LABEL[audience]}
                </p>
              ) : null}
              {topics
                .filter((t) => t.audience === audience)
                .map((t) => (
                  <TopicButton
                    key={t.id}
                    active={activeTopic === t.id}
                    onClick={() => setActiveTopic(t.id)}
                    label={t.title}
                    icon={ICONS[t.icon]}
                  />
                ))}
            </Fragment>
          ))}
        </nav>
      </aside>

      <div className="grid gap-5">
        {q ? (
          <p className="text-sm text-muted-foreground">
            {resultCount} pertanyaan cocok dengan “{query.trim()}”
          </p>
        ) : null}

        {visible.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border px-4 py-14 text-center">
            <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <SearchX className="size-5" />
            </span>
            <p className="text-sm font-medium">Tidak ada pertanyaan yang cocok</p>
            <p className="max-w-sm text-xs text-muted-foreground">
              Coba kata kunci lain. Kalau jawabannya tetap tidak ada, kirim pertanyaan lewat Laporkan Kendala.
            </p>
          </div>
        ) : (
          visible.map((topic) => {
            const Icon = ICONS[topic.icon]
            return (
              <section key={topic.id} className="overflow-hidden rounded-xl border bg-card">
                <header className="flex flex-col gap-3 border-b bg-muted/30 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <Icon className="size-4" />
                    </span>
                    <div>
                      <h2 className="flex flex-wrap items-center gap-2 text-base font-semibold">
                        {topic.title}
                        {showAudience && topic.audience !== "pegawai" ? (
                          <span className="rounded-full border px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                            {FAQ_AUDIENCE_LABEL[topic.audience]}
                          </span>
                        ) : null}
                      </h2>
                      <p className="text-xs text-muted-foreground">{topic.description}</p>
                    </div>
                  </div>
                  {topic.link ? (
                    <Link
                      href={topic.link.href}
                      className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary hover:underline"
                    >
                      {topic.link.label}
                      <ArrowRight className="size-3.5" />
                    </Link>
                  ) : null}
                </header>
                {/* key ikut mode supaya <details> dipasang ulang saat mulai/berhenti mencari */}
                <div key={q ? "search" : "browse"}>
                  {topic.items.map((item) => (
                    <QuestionRow key={item.q} item={item} open={Boolean(q)} />
                  ))}
                </div>
              </section>
            )
          })
        )}
      </div>
    </div>
  )
}

function TopicButton({
  active,
  onClick,
  label,
  icon: Icon,
}: {
  active: boolean
  onClick: () => void
  label: string
  icon?: LucideIcon
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex shrink-0 items-center gap-2 rounded-md border px-2.5 py-1.5 text-left text-sm whitespace-nowrap transition-colors lg:border-transparent lg:whitespace-normal",
        active
          ? "border-primary bg-primary/10 font-medium text-primary lg:border-transparent"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      {Icon ? <Icon className="size-4 shrink-0" /> : null}
      {label}
    </button>
  )
}
