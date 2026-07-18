"use client"

import { useTransition } from "react"
import Link from "next/link"
import { Bell } from "lucide-react"

import {
  markNotificationReadAction,
  markAllNotificationsReadAction,
} from "@/server/actions/notifications"
import { getNotificationIcon } from "@/lib/notification-icon"
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
  basePath,
}: {
  notifications: NotificationItem[]
  basePath: "/admin" | "/pegawai"
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
              const ItemIcon = getNotificationIcon(item.title)
              const body = (
                <div
                  className={`flex items-start gap-2.5 rounded-md px-2 py-2 text-left transition-colors hover:bg-muted ${
                    item.isRead ? "" : "bg-primary/5"
                  }`}
                >
                  <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <ItemIcon className="size-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{item.title}</p>
                    <p className="text-xs text-muted-foreground">{item.message}</p>
                    <p className="text-[10px] text-muted-foreground">{item.createdAt}</p>
                  </div>
                </div>
              )
              const handleClick = () =>
                startTransition(() => markNotificationReadAction(item.id))

              // Link (anchor) tidak boleh bersarang di dalam button — HTML
              // tidak valid dan klik-nya jadi tidak jalan. Jadi elemen
              // interaktifnya cuma satu: Link kalau ada tujuan, button kalau
              // tidak.
              return item.link ? (
                <Link
                  key={item.id}
                  href={item.link}
                  className="block w-full"
                  onClick={handleClick}
                >
                  {body}
                </Link>
              ) : (
                <button
                  key={item.id}
                  type="button"
                  className="block w-full"
                  onClick={handleClick}
                >
                  {body}
                </button>
              )
            })}
          </div>
        )}
        <DropdownMenuSeparator />
        <Link
          href={`${basePath}/notifikasi`}
          className="block px-1.5 py-1.5 text-center text-xs font-medium text-primary hover:underline"
        >
          Lihat semua notifikasi
        </Link>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
