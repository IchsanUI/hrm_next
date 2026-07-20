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

function isEntryActive(entry: NavEntry, pathname: string) {
  if (entry.type === "divider") return false
  if (entry.type === "link") {
    return pathname === entry.href || pathname.startsWith(`${entry.href}/`)
  }
  return entry.items.some(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`)
  )
}

function NavLinkItem({
  label,
  href,
  icon,
  isActive,
  indent,
  onNavigate,
}: {
  label: string
  href: string
  icon?: ReactNode
  isActive: boolean
  indent?: boolean
  onNavigate?: () => void
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
      <span className="truncate">{label}</span>
    </Link>
  )
}

function NavGroupItem({
  group,
  pathname,
  onNavigate,
}: {
  group: NavGroup
  pathname: string
  onNavigate?: () => void
}) {
  const groupIsActive = isEntryActive(group, pathname)
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
              icon={item.icon}
              isActive={
                pathname === item.href || pathname.startsWith(`${item.href}/`)
              }
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
            isActive={isEntryActive(entry, pathname)}
            onNavigate={onNavigate}
          />
        ) : (
          <NavGroupItem
            key={entry.label}
            group={entry}
            pathname={pathname}
            onNavigate={onNavigate}
          />
        )
      )}
    </nav>
  )
}
