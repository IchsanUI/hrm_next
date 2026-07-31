import Link from "next/link"
import type { LucideIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { FORCE_LIGHT_THEME } from "@/lib/force-light-theme"

// Tampilan dasar dipakai bareng oleh not-found.tsx, error.tsx, dan
// global-error.tsx — supaya ketiganya (404, error route, error fatal di
// root layout) tetap terasa satu identitas visual dengan sisa app (navy +
// kartu putih), bukan halaman putih polos bawaan Next.js.
export function ErrorPageShell({
  icon: Icon,
  code,
  title,
  description,
  primaryAction,
  secondaryAction,
}: {
  icon: LucideIcon
  code?: string
  title: string
  description: string
  primaryAction?: { label: string; href: string }
  secondaryAction?: { label: string; onClick: () => void }
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-blue-950 p-4">
      <div
        className="w-full max-w-md rounded-2xl border border-white/10 bg-white p-8 text-center shadow-xl"
        style={FORCE_LIGHT_THEME}
      >
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-blue-950/5 text-blue-950">
          <Icon className="size-7" strokeWidth={1.5} />
        </span>
        {code ? (
          <p className="mt-4 text-sm font-semibold tracking-wide text-blue-950/50">{code}</p>
        ) : null}
        <h1 className="mt-1 text-xl font-semibold text-foreground">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          {secondaryAction ? (
            <Button type="button" variant="outline" onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </Button>
          ) : null}
          {primaryAction ? (
            <Button render={<Link href={primaryAction.href} />} nativeButton={false}>
              {primaryAction.label}
            </Button>
          ) : null}
        </div>
      </div>
    </main>
  )
}
