import { cn } from "@/lib/utils"
import { ISSUE_STATUS_LABEL, type IssueStatus } from "@/lib/issue-report-labels"

// Warna status Laporan Kendala — satu sumber untuk badge, titik indikator,
// dan ikon kartu ringkasan supaya konsisten di halaman pegawai & admin.
export const ISSUE_STATUS_TONE: Record<IssueStatus, { badge: string; dot: string; icon: string }> = {
  BARU: {
    badge: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
    dot: "bg-amber-500",
    icon: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  },
  DIPROSES: {
    badge: "bg-sky-500/15 text-sky-700 dark:text-sky-400",
    dot: "bg-sky-500",
    icon: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
  },
  SELESAI: {
    badge: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
    dot: "bg-emerald-500",
    icon: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  },
  DITOLAK: {
    badge: "bg-rose-500/15 text-rose-700 dark:text-rose-400",
    dot: "bg-rose-500",
    icon: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
  },
}

export function IssueStatusBadge({ status, className }: { status: IssueStatus; className?: string }) {
  const tone = ISSUE_STATUS_TONE[status]
  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium whitespace-nowrap",
        tone.badge,
        className
      )}
    >
      <span className={cn("size-1.5 rounded-full", tone.dot)} />
      {ISSUE_STATUS_LABEL[status]}
    </span>
  )
}

export function TicketNumber({ value, className }: { value: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs font-medium tracking-tight whitespace-nowrap",
        className
      )}
    >
      {value}
    </span>
  )
}
