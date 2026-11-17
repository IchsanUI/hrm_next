import { AlertTriangle, CheckCircle2, CircleDashed, XCircle, type LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import {
  CERTIFICATE_STATUS_LABEL,
  COMPLIANCE_STATUS_LABEL,
  type CertificateStatus,
  type ComplianceStatus,
} from "@/lib/certification-status"

// Warna status selalu disertai ikon + label (tidak mengandalkan warna saja).
const TONE: Record<ComplianceStatus, { className: string; icon: LucideIcon }> = {
  TERPENUHI: {
    className: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300",
    icon: CheckCircle2,
  },
  SEGERA: {
    className: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300",
    icon: AlertTriangle,
  },
  KEDALUWARSA: {
    className: "border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300",
    icon: XCircle,
  },
  BELUM_ADA: {
    className: "border-border bg-muted text-muted-foreground",
    icon: CircleDashed,
  },
}

export function ComplianceBadge({ status, className }: { status: ComplianceStatus; className?: string }) {
  const { className: tone, icon: Icon } = TONE[status]
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap", tone, className)}>
      <Icon className="size-3.5" />
      {COMPLIANCE_STATUS_LABEL[status]}
    </span>
  )
}

export function CertificateBadge({ status, className }: { status: CertificateStatus; className?: string }) {
  const { className: tone, icon: Icon } = TONE[status === "AKTIF" ? "TERPENUHI" : status]
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap", tone, className)}>
      <Icon className="size-3.5" />
      {CERTIFICATE_STATUS_LABEL[status]}
    </span>
  )
}

export const COMPLIANCE_BAR_CLASS: Record<ComplianceStatus, string> = {
  TERPENUHI: "bg-emerald-500",
  SEGERA: "bg-amber-400",
  KEDALUWARSA: "bg-red-500",
  BELUM_ADA: "bg-muted-foreground/25",
}
