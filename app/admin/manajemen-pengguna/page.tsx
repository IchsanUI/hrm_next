import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { Breadcrumb } from "@/components/breadcrumb"
import { UserManagementTable } from "@/components/user-management-table"

export default async function ManajemenPenggunaPage() {
  const session = await auth()
  if (session?.user.role !== "SUPER_ADMIN") {
    redirect("/admin/dashboard")
  }

  const users = await prisma.user.findMany({
    include: {
      role: true,
      employee: { select: { fullName: true, employeeNumber: true } },
    },
    orderBy: { username: "asc" },
  })
  const userIds = users.map((u) => u.id)

  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const [lastLogins, failedLogins] = await Promise.all([
    prisma.activityLog.groupBy({
      by: ["userId"],
      where: { action: "LOGIN", userId: { in: userIds } },
      _max: { createdAt: true },
    }),
    prisma.activityLog.groupBy({
      by: ["userId"],
      where: { action: "LOGIN_FAILED", userId: { in: userIds }, createdAt: { gte: sevenDaysAgo } },
      _count: { _all: true },
    }),
  ])
  const lastLoginMap = new Map(lastLogins.map((l) => [l.userId, l._max.createdAt]))
  const failedLoginMap = new Map(failedLogins.map((l) => [l.userId, l._count._all]))

  return (
    <div>
      <Breadcrumb
        items={[
          { label: "Dashboard", href: "/admin/dashboard" },
          { label: "Manajemen Pengguna" },
        ]}
      />
      <h1 className="mb-1 text-2xl font-semibold">Manajemen Pengguna</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Kelola siklus hidup akun login — buat akun sistem, reset password,
        aktifkan/nonaktifkan akun, dan ubah role akun sistem. Akun yang
        terhubung ke data pegawai tetap dikelola lewat Manajemen Akses HR
        untuk akses menunya.
      </p>
      <UserManagementTable
        users={users.map((u) => ({
          id: u.id,
          username: u.username,
          isActive: u.isActive,
          role: u.role.name,
          employeeId: u.employeeId,
          employeeFullName: u.employee?.fullName ?? null,
          employeeNumber: u.employee?.employeeNumber ?? null,
          lastLoginAt: lastLoginMap.get(u.id) ?? null,
          failedLoginCount: failedLoginMap.get(u.id) ?? 0,
        }))}
        currentUserId={Number(session.user.id)}
      />
    </div>
  )
}
