"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { DatabaseBackup, History, Settings2 } from "lucide-react"

import { cn } from "@/lib/utils"

const TABS = [
  { href: "/admin/backup/database", label: "Backup Sekarang", icon: DatabaseBackup },
  { href: "/admin/backup/database/riwayat", label: "Riwayat", icon: History },
  { href: "/admin/backup/database/pengaturan", label: "Pengaturan", icon: Settings2 },
]

// Tab navigasi Backup Database — tiap tab halaman sendiri (bukan state
// client) supaya filter tanggal di Riwayat tetap bisa memakai query string.
export function BackupTabs() {
  const pathname = usePathname()
  return (
    <nav className="flex gap-1 overflow-x-auto border-b" aria-label="Bagian Backup Database">
      {TABS.map((tab) => {
        const active = pathname === tab.href
        const Icon = tab.icon
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px inline-flex items-center gap-2 border-b-2 px-3 py-2 text-sm whitespace-nowrap transition",
              active
                ? "border-primary font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="size-4" />
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
