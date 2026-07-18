"use client";

import { useTransition } from "react";
import Link from "next/link";
import { Bell, CheckCheck, Clock } from "lucide-react";

import {
  markNotificationReadAction,
  markAllNotificationsReadAction,
} from "@/server/actions/notifications";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { getNotificationIcon } from "@/lib/notification-icon";
import type { NotificationItem } from "@/components/notifications-menu";

export function NotificationsPageContent({
  notifications,
}: {
  notifications: NotificationItem[];
}) {
  const [isPending, startTransition] = useTransition();
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold">Notifikasi</h1>
            {unreadCount > 0 ? (
              <Badge variant="secondary">{unreadCount} belum dibaca</Badge>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Semua notifikasi yang pernah Anda terima.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={unreadCount === 0 || isPending}
          onClick={() =>
            startTransition(() => markAllNotificationsReadAction())
          }
        >
          <CheckCheck className="size-3.5" />
          Tandai semua dibaca
        </Button>
      </div>

      {notifications.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center gap-2 py-12 text-center text-sm text-muted-foreground">
            <Bell className="size-6" />
            Belum ada notifikasi.
          </div>
        </Card>
      ) : (
        <div className="grid gap-2">
          {notifications.map((item) => {
            const markRead = () =>
              startTransition(() => markNotificationReadAction(item.id));
            const ItemIcon = getNotificationIcon(item.title);

            const content = (
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{item.title}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {item.message}
                </p>
              </div>
            );

            return (
              <Card
                key={item.id}
                className={cn(
                  "flex-row items-start gap-3 px-4 py-3 shadow-sm transition-shadow hover:shadow-md",
                  !item.isRead && "border-primary/30 bg-primary/5",
                )}
              >
                <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <ItemIcon className="size-4.5" />
                </span>

                {item.link ? (
                  <Link
                    href={item.link}
                    className="min-w-0 flex-1"
                    onClick={markRead}
                  >
                    {content}
                  </Link>
                ) : (
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={markRead}
                    className="min-w-0 flex-1 cursor-pointer"
                  >
                    {content}
                  </div>
                )}

                <span className="mt-0.5 flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="size-3" />
                  {item.createdAt}
                </span>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
