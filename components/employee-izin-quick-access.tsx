import Link from "next/link"
import {
  AlertTriangle,
  ArrowUpRight,
  Briefcase,
  Clock,
  Landmark,
  LogOut,
  Stethoscope,
  type LucideIcon,
} from "lucide-react"

import { cn } from "@/lib/utils"
import type { QuickAccessItem } from "@/lib/employee-dashboard-stats"

// Tiap jenis izin punya satu hue soft — background tint lembut + chip ikon
// solid pastel + angka berwarna senada, biar tidak polos tapi tetap kalem.
// Ikonnya sama dengan yang dipakai di lib/leave-types.ts biar konsisten.
const TILE_STYLE: Record<
  string,
  { icon: LucideIcon; card: string; chip: string; value: string }
> = {
  lembur: {
    icon: Clock,
    card: "bg-blue-50/60 hover:border-blue-300 dark:bg-blue-500/[0.05] dark:hover:border-blue-500/40",
    chip: "bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400",
    value: "text-blue-600 dark:text-blue-400",
  },
  terlambat: {
    icon: AlertTriangle,
    card: "bg-amber-50/60 hover:border-amber-300 dark:bg-amber-500/[0.05] dark:hover:border-amber-500/40",
    chip: "bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400",
    value: "text-amber-600 dark:text-amber-400",
  },
  pulang_cepat: {
    icon: Briefcase,
    card: "bg-violet-50/60 hover:border-violet-300 dark:bg-violet-500/[0.05] dark:hover:border-violet-500/40",
    chip: "bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400",
    value: "text-violet-600 dark:text-violet-400",
  },
  sakit: {
    icon: Stethoscope,
    card: "bg-rose-50/60 hover:border-rose-300 dark:bg-rose-500/[0.05] dark:hover:border-rose-500/40",
    chip: "bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400",
    value: "text-rose-600 dark:text-rose-400",
  },
  meninggalkan_kantor: {
    icon: LogOut,
    card: "bg-emerald-50/60 hover:border-emerald-300 dark:bg-emerald-500/[0.05] dark:hover:border-emerald-500/40",
    chip: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400",
    value: "text-emerald-600 dark:text-emerald-400",
  },
  cuti_khusus: {
    icon: Landmark,
    card: "bg-teal-50/60 hover:border-teal-300 dark:bg-teal-500/[0.05] dark:hover:border-teal-500/40",
    chip: "bg-teal-100 text-teal-600 dark:bg-teal-500/15 dark:text-teal-400",
    value: "text-teal-600 dark:text-teal-400",
  },
}

export function EmployeeIzinQuickAccess({ items }: { items: QuickAccessItem[] }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
      {items.map((item) => {
        const style = TILE_STYLE[item.key]
        const Icon = style?.icon ?? Clock
        return (
          <Link
            key={item.key}
            href={item.href}
            className={cn(
              "group flex flex-col gap-3 rounded-xl border p-4 transition-all hover:-translate-y-0.5 hover:shadow-sm",
              style?.card
            )}
          >
            <div className="flex items-center justify-between">
              <span
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-lg",
                  style?.chip
                )}
              >
                <Icon className="size-4.5" />
              </span>
              <ArrowUpRight className="size-4 text-muted-foreground/50 transition-colors group-hover:text-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">{item.label}</p>
              <p className="mt-1 flex items-baseline gap-1">
                <span className={cn("text-xl font-semibold tabular-nums", style?.value)}>
                  {item.count}
                </span>
                <span className="text-xs text-muted-foreground">pengajuan</span>
              </p>
            </div>
          </Link>
        )
      })}
    </div>
  )
}
