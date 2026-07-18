import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { formatRelativeTime } from "@/lib/relative-time"
import { Breadcrumb } from "@/components/breadcrumb"
import { NotificationsPageContent } from "@/components/notifications-page-content"
import type { NotificationItem } from "@/components/notifications-menu"

export default async function AdminNotifikasiPage() {
  const session = await auth()

  const notifications = session?.user.id
    ? await prisma.notification.findMany({
        where: { userId: Number(session.user.id) },
        orderBy: { createdAt: "desc" },
        take: 100,
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
    <div>
      <Breadcrumb
        items={[
          { label: "Dashboard", href: "/admin/dashboard" },
          { label: "Notifikasi" },
        ]}
      />
      <NotificationsPageContent notifications={notificationItems} />
    </div>
  )
}
