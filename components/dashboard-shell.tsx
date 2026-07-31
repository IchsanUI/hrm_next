import Image from "next/image"

import { DashboardNav, type NavEntry } from "@/components/dashboard-nav"
import { DashboardTopbar } from "@/components/dashboard-topbar"
import { SidebarVersion } from "@/components/sidebar-version"

export function DashboardShell({
  username,
  roleLabel,
  profileHref,
  navItems,
  basePath,
  children,
  floating,
  banner,
}: {
  username: string
  roleLabel: string
  profileHref?: string
  navItems: NavEntry[]
  basePath: "/admin" | "/pegawai"
  children: React.ReactNode
  // Konten `position: fixed` (mis. LocationPermissionPrompt) — SENGAJA
  // dirender di sini, BUKAN lewat `children`, karena `children` masuk ke
  // dalam <main> yang `overflow-y-auto` (dan leluhurnya `overflow-hidden`).
  // Elemen fixed yang dinest di situ gampang ke-clip/ketutup scroll area,
  // bukan benar-benar mengambang di atas seluruh viewport.
  floating?: React.ReactNode
  // Bar penuh-lebar yang MENEMPEL persis di bawah topbar (mis.
  // PwaInstallBanner) — dirender di sini, BUKAN lewat `children`, karena
  // <main> punya padding (p-3/p-4/p-6) yang bikin bar kelihatan "mengambang"
  // dengan jarak ke topbar, bukan menempel edge-to-edge.
  banner?: React.ReactNode
}) {
  return (
    <div className="relative flex h-screen min-h-0 overflow-hidden print:h-auto print:overflow-visible">
      <aside className="sidebar-scroll hidden w-64 shrink-0 flex-col overflow-y-auto border-r border-white/10 bg-blue-950 p-4 md:flex print:hidden">
        <div className="mb-6 flex items-center gap-2 px-3">
          <Image
            src="/LogoSystemWhite.png"
            alt="Logo"
            width={28}
            height={28}
            className="shrink-0"
          />
          <span className="text-lg font-bold text-white" title="Human Resource Information System">
            HRIS
          </span>
        </div>
        <div className="mb-6">
          <DashboardNav items={navItems} />
        </div>
        <SidebarVersion />
      </aside>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden print:h-auto print:overflow-visible">
        <div className="print:hidden">
          <DashboardTopbar
            username={username}
            roleLabel={roleLabel}
            profileHref={profileHref}
            navItems={navItems}
            basePath={basePath}
          />
        </div>
        {banner}
        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 print:h-auto print:overflow-visible print:p-0">
          {children}
        </main>
      </div>
      {floating}
    </div>
  )
}
