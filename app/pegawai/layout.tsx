import { redirect } from "next/navigation"
import {
  LayoutDashboard,
  UserRound,
  Settings,
  FilePlus2,
  History,
  ClipboardCheck,
} from "lucide-react"

import { auth } from "@/auth"
import { DashboardShell } from "@/components/dashboard-shell"
import type { NavEntry } from "@/components/dashboard-nav"

const navItems: NavEntry[] = [
  {
    type: "link",
    label: "Dashboard",
    href: "/pegawai/dashboard",
    icon: <LayoutDashboard className="size-4 shrink-0" />,
  },
  {
    type: "link",
    label: "Profil Saya",
    href: "/pegawai/profil",
    icon: <UserRound className="size-4 shrink-0" />,
  },
  {
    type: "link",
    label: "Ajukan Izin",
    href: "/pegawai/ajukan-izin",
    icon: <FilePlus2 className="size-4 shrink-0" />,
  },
  {
    type: "link",
    label: "Riwayat Izin",
    href: "/pegawai/riwayat-izin",
    icon: <History className="size-4 shrink-0" />,
  },
  {
    type: "link",
    label: "Approval Center",
    href: "/pegawai/approval-center",
    icon: <ClipboardCheck className="size-4 shrink-0" />,
  },
  {
    type: "link",
    label: "Peraturan",
    href: "/pegawai/pengaturan",
    icon: <Settings className="size-4 shrink-0" />,
  },
]

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  HR_ADMIN: "HR Admin",
  EMPLOYEE: "Pegawai",
}

export default async function EmployeeLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  // Akses /pegawai/** berdasarkan "punya data pegawai" (employeeId), bukan
  // role — HR_ADMIN tetap pegawai sungguhan dan berhak akses self-service
  // miliknya sendiri (profil, ajukan izin, dst).
  if (!session?.user) {
    redirect("/login")
  }
  if (!session.user.employeeId) {
    redirect("/admin/dashboard")
  }

  return (
    <DashboardShell
      username={session.user.username}
      roleLabel={ROLE_LABEL[session.user.role] ?? "Pegawai"}
      profileHref="/pegawai/profil"
      navItems={navItems}
      basePath="/pegawai"
    >
      {children}
    </DashboardShell>
  )
}
