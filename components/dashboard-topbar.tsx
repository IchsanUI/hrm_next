import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { formatRelativeTime } from "@/lib/relative-time"
import type { NavEntry } from "@/components/dashboard-nav"
import { MobileNav } from "@/components/mobile-nav"
import { NotificationsMenu, type NotificationItem } from "@/components/notifications-menu"
import { ThemeToggle } from "@/components/theme-toggle"
import { UserMenu } from "@/components/user-menu"

export async function DashboardTopbar({
  username,
  roleLabel,
  profileHref,
  navItems,
  basePath,
}: {
  username: string
  roleLabel: string
  profileHref?: string
  navItems: NavEntry[]
  basePath: "/admin" | "/pegawai"
}) {
  const session = await auth()
  const notifications = session?.user.id
    ? await prisma.notification.findMany({
        where: { userId: Number(session.user.id) },
        orderBy: { createdAt: "desc" },
        take: 20,
      })
    : []

  const notificationItems: NotificationItem[] = notifications.map((n) => ({
    id: n.id,
    title: n.title,
    message: n.message,
    link: n.link,
    isRead: n.isRead,
    createdAt: formatRelativeTime(n.createdAt),
  }))

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b px-3 sm:px-4 md:px-6">
      <div className="flex items-center gap-2">
        <MobileNav navItems={navItems} />
        <span className="text-lg font-bold md:hidden">HRIS</span>
      </div>
      <div className="ml-auto flex items-center gap-0.5 sm:gap-1">
        <NotificationsMenu notifications={notificationItems} basePath={basePath} />
        <ThemeToggle />
        <UserMenu
          username={username}
          roleLabel={roleLabel}
          profileHref={profileHref}
        />
      </div>
    </header>
  )
}
