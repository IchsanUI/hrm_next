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
}: {
  username: string
  roleLabel: string
  profileHref?: string
  navItems: NavEntry[]
  basePath: "/admin" | "/pegawai"
  children: React.ReactNode
}) {
  return (
    <div className="relative flex h-screen min-h-0 overflow-hidden print:h-auto print:overflow-visible">
      <aside className="hidden w-64 shrink-0 flex-col overflow-y-auto border-r border-white/10 bg-blue-950 p-4 md:flex print:hidden">
        <div className="mb-6 flex items-center gap-2 px-3">
          <Image
            src="/LogoSystemWhite.png"
            alt="Logo"
            width={28}
            height={28}
            className="shrink-0"
          />
          <span className="text-lg font-bold text-white">HRM</span>
        </div>
        <DashboardNav items={navItems} />
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
        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 print:h-auto print:overflow-visible print:p-0">
          {children}
        </main>
      </div>
    </div>
  )
}
