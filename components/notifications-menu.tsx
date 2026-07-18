"use client"

import { useTransition } from "react"
import Link from "next/link"
import { Bell } from "lucide-react"

import {
  markNotificationReadAction,
  markAllNotificationsReadAction,
} from "@/server/actions/notifications"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export type NotificationItem = {
  id: number
  title: string
  message: string
  link: string | null
  isRead: boolean
  createdAt: string
}

export function NotificationsMenu({
  notifications,
}: {
  notifications: NotificationItem[]
}) {
  const [, startTransition] = useTransition()
  const unreadCount = notifications.filter((n) => !n.isRead).length

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label="Notifikasi"
            className="relative"
          />
        }
      >
        <Bell className="size-4" />
        {unreadCount > 0 ? (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between px-1.5 py-1">
          <span className="text-xs font-medium text-muted-foreground">Notifikasi</span>
          {unreadCount > 0 ? (
            <button
              type="button"
              className="text-xs text-primary hover:underline"
              onClick={() => startTransition(() => markAllNotificationsReadAction())}
            >
              Tandai semua dibaca
            </button>
          ) : null}
        </div>
        <DropdownMenuSeparator />
        {notifications.length === 0 ? (
          <div className="px-2 py-6 text-center text-sm text-muted-foreground">
            Belum ada notifikasi baru.
          </div>
        ) : (
          <div className="max-h-80 overflow-y-auto">
            {notifications.map((item) => {
              const body = (
                <div
                  className={`flex flex-col gap-0.5 rounded-md px-2 py-2 text-left transition-colors hover:bg-muted ${
                    item.isRead ? "" : "bg-primary/5"
                  }`}
                >
                  <span className="text-sm font-medium">{item.title}</span>
                  <span className="text-xs text-muted-foreground">{item.message}</span>
                  <span className="text-[10px] text-muted-foreground">{item.createdAt}</span>
                </div>
              )
              return (
                <button
                  key={item.id}
                  type="button"
                  className="block w-full"
                  onClick={() =>
                    startTransition(() => markNotificationReadAction(item.id))
                  }
                >
                  {item.link ? (
                    <Link href={item.link} className="block">
                      {body}
                    </Link>
                  ) : (
                    body
                  )}
                </button>
              )
            })}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
