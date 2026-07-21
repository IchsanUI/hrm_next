import Link from "next/link"
import { ArrowRight, Construction, type LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

const THEME = {
  blue: {
    card: "bg-blue-50/50 dark:bg-blue-500/[0.04]",
    chip: "bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400",
  },
  violet: {
    card: "bg-violet-50/50 dark:bg-violet-500/[0.04]",
    chip: "bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400",
  },
  emerald: {
    card: "bg-emerald-50/50 dark:bg-emerald-500/[0.04]",
    chip: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400",
  },
  amber: {
    card: "bg-amber-50/50 dark:bg-amber-500/[0.04]",
    chip: "bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400",
  },
  rose: {
    card: "bg-rose-50/50 dark:bg-rose-500/[0.04]",
    chip: "bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400",
  },
} as const

// Widget "coming soon" buat modul yang masih blueprint (belum ada data
// aktif) — mengisi slot dashboard tanpa berpura-pura sudah ada data
// sungguhan. Link mengarah ke halaman blueprint lengkap modul terkait.
export function DashboardBlueprintCard({
  title,
  description,
  icon: Icon,
  href,
  plannedFeatures,
  color = "blue",
}: {
  title: string
  description: string
  icon: LucideIcon
  href: string
  plannedFeatures: string[]
  color?: keyof typeof THEME
}) {
  const theme = THEME[color]

  return (
    <Card className={cn("h-full", theme.card)}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-3 py-6 text-center">
        <span className={cn("flex size-10 items-center justify-center rounded-full", theme.chip)}>
          <Icon className="size-5" />
        </span>
        <div>
          <p className="text-sm font-medium">Modul ini belum aktif</p>
          <p className="mt-1 flex items-center justify-center gap-1 text-xs text-muted-foreground">
            <Construction className="size-3.5" />
            Masih tahap blueprint pengembangan
          </p>
        </div>
        <ul className="mt-1 grid w-full gap-1.5 text-left">
          {plannedFeatures.map((feature) => (
            <li key={feature} className="flex items-start gap-2 text-xs text-muted-foreground">
              <span className="mt-1.5 size-1 shrink-0 rounded-full bg-muted-foreground" />
              {feature}
            </li>
          ))}
        </ul>
        <Link
          href={href}
          className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          Lihat rencana modul
          <ArrowRight className="size-3.5" />
        </Link>
      </CardContent>
    </Card>
  )
}
