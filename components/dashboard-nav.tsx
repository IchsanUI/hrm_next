"use client"

import { useState, type ReactNode } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronDown } from "lucide-react"

import { cn } from "@/lib/utils"

export type NavSubItem = {
  label: string
  href: string
  icon?: ReactNode
}

export type NavLink = {
  type: "link"
  label: string
  href: string
  icon?: ReactNode
  // Jumlah item yang perlu diperhatikan pegawai ini (mis. approval yang
  // masih menunggu) — ditampilkan sebagai badge bulat di ujung kanan menu.
  // Cuma dirender kalau > 0.
  badge?: number
}

export type NavGroup = {
  type: "group"
  label: string
  icon?: ReactNode
  items: NavSubItem[]
}

// Pemisah visual murni (tidak bisa diklik) — dipakai buat mengelompokkan
// menu secara visual, mis. memisahkan menu operasional HR dari menu
// khusus Super Admin (Manajemen Akses HR, Log Aktivitas).
export type NavDivider = {
  type: "divider"
}

export type NavEntry = NavLink | NavGroup | NavDivider

// Komponen ini selalu dirender di dalam sidebar navy (lihat DashboardShell &
// MobileNav), jadi warnanya sengaja di-hardcode putih/navy, bukan mengikuti
// variabel tema light/dark, supaya sidebar tetap konsisten di kedua mode.
//
// `icon` berupa ReactNode yang sudah dirender (mis. `<Home className="..." />`),
// bukan referensi komponen mentah — referensi komponen tidak boleh dikirim
// dari Server Component ke Client Component seperti ini.
const ITEM_BASE =
  "rounded-md px-3 py-2 text-sm font-medium transition-colors"
const ITEM_INACTIVE = "text-white/75 hover:bg-white/10 hover:text-white"
const ITEM_ACTIVE = "bg-blue-800 text-white"

function matches(href: string, pathname: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}

// Menu aktif = menu dengan href PALING SPESIFIK yang cocok dengan halaman
// saat ini. Tanpa ini, halaman bersarang (mis. /admin/payroll/klaim-kesehatan/
// pengaturan) ikut menyorot menu induknya (/admin/payroll/klaim-kesehatan)
// sehingga dua menu tampak aktif bersamaan.
function findActiveHref(items: NavEntry[], pathname: string) {
  let best: string | null = null
  for (const entry of items) {
    const hrefs = entry.type === "link" ? [entry.href] : entry.type === "group" ? entry.items.map((i) => i.href) : []
    for (const href of hrefs) {
      if (matches(href, pathname) && (!best || href.length > best.length)) best = href
    }
  }
  return best
}

function isEntryActive(entry: NavEntry, activeHref: string | null) {
  if (entry.type === "divider" || !activeHref) return false
  if (entry.type === "link") return entry.href === activeHref
  return entry.items.some((item) => item.href === activeHref)
}

function NavLinkItem({
  label,
  href,
  icon,
  isActive,
  indent,
  onNavigate,
  badge,
}: {
  label: string
  href: string
  icon?: ReactNode
  isActive: boolean
  indent?: boolean
  onNavigate?: () => void
  badge?: number
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={cn(
        ITEM_BASE,
        "flex items-center gap-2",
        indent && "ml-3",
        isActive ? ITEM_ACTIVE : ITEM_INACTIVE
      )}
    >
      {icon ? <span className="shrink-0 [&_svg]:size-4">{icon}</span> : null}
      <span className="truncate flex-1">{label}</span>
      {badge ? (
        <span className="flex h-4.5 min-w-4.5 shrink-0 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-white">
          {badge > 9 ? "9+" : badge}
        </span>
      ) : null}
    </Link>
  )
}

function NavGroupItem({
  group,
  activeHref,
  onNavigate,
}: {
  group: NavGroup
  activeHref: string | null
  onNavigate?: () => void
}) {
  const groupIsActive = isEntryActive(group, activeHref)
  const [open, setOpen] = useState(groupIsActive)

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          ITEM_BASE,
          "flex w-full items-center justify-between",
          groupIsActive && !open ? ITEM_ACTIVE : ITEM_INACTIVE
        )}
      >
        <span className="flex items-center gap-2">
          {group.icon ? (
            <span className="shrink-0 [&_svg]:size-4">{group.icon}</span>
          ) : null}
          {group.label}
        </span>
        <ChevronDown
          className={cn("size-4 shrink-0 transition-transform", open && "rotate-180")}
        />
      </button>
      {open ? (
        <div className="mt-1 flex flex-col gap-1">
          {group.items.map((item) => (
            <NavLinkItem
              key={item.href}
              label={item.label}
              href={item.href}
              isActive={item.href === activeHref}
              indent
              onNavigate={onNavigate}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

export function DashboardNav({
  items,
  onNavigate,
}: {
  items: NavEntry[]
  onNavigate?: () => void
}) {
  const pathname = usePathname()
  const activeHref = findActiveHref(items, pathname)

  return (
    <nav className="flex flex-col gap-1">
      {items.map((entry, index) =>
        entry.type === "divider" ? (
          <div
            key={`divider-${index}`}
            className="my-2 border-t border-white/10"
            role="separator"
          />
        ) : entry.type === "link" ? (
          <NavLinkItem
            key={entry.href}
            label={entry.label}
            href={entry.href}
            icon={entry.icon}
            isActive={isEntryActive(entry, activeHref)}
            onNavigate={onNavigate}
            badge={entry.badge}
          />
        ) : (
          <NavGroupItem
            key={entry.label}
            group={entry}
            activeHref={activeHref}
            onNavigate={onNavigate}
          />
        )
      )}
    </nav>
  )
}
