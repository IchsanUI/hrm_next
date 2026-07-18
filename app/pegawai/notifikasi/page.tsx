import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { formatRelativeTime } from "@/lib/relative-time"
import { NotificationsPageContent } from "@/components/notifications-page-content"
import type { NotificationItem } from "@/components/notifications-menu"

export default async function PegawaiNotifikasiPage() {
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

  return <NotificationsPageContent notifications={notificationItems} />
}
