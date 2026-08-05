import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { DashboardShell } from "@/components/dashboard-shell"
import { buildAdminNavItems } from "@/lib/admin-nav-items"
import { getPendingApprovalCount } from "@/lib/approval-queue"

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  HR_ADMIN: "HR Admin",
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  const role = session?.user.role
  const isAdminRole = role === "SUPER_ADMIN" || role === "HR_ADMIN"
  if (!session?.user || !isAdminRole) {
    redirect("/login")
  }

  // Ajukan Izin/Riwayat Izin cuma relevan buat akun yang benar-benar terhubung
  // ke data pegawai (EMPLOYEE atau HR_ADMIN). Akun sistem murni (SUPER_ADMIN
  // tanpa employeeId) tidak punya identitas pegawai untuk mengajukan izin.
  const hasEmployeeIdentity = Boolean(session.user.employeeId)
  const pendingApprovalCount = hasEmployeeIdentity
    ? await getPendingApprovalCount(session.user.employeeId)
    : 0

  const navItems = buildAdminNavItems({
    role,
    menuAccess: session.user.menuAccess,
    hasEmployeeIdentity,
    pendingApprovalCount,
  })

  return (
    <DashboardShell
      username={session.user.username}
      roleLabel={ROLE_LABEL[role] ?? "Admin"}
      profileHref="/admin/profil"
      navItems={navItems}
      basePath="/admin"
    >
      {children}
    </DashboardShell>
  )
}
