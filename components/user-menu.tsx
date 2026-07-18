"use client"

import { useTransition } from "react"
import Link from "next/link"
import { LogOut, User } from "lucide-react"

import { logoutAction } from "@/server/actions/logout"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function UserMenu({
  username,
  roleLabel,
  profileHref,
}: {
  username: string
  roleLabel: string
  profileHref?: string
}) {
  const [isPending, startTransition] = useTransition()
  const initial = username.slice(0, 1).toUpperCase()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            className="h-auto gap-2 px-1.5 py-1"
            aria-label="Menu pengguna"
          />
        }
      >
        <Avatar size="sm">
          <AvatarFallback>{initial}</AvatarFallback>
        </Avatar>
        <span className="hidden max-w-32 truncate text-sm font-medium md:inline">
          {username}
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <div className="flex flex-col gap-0.5 px-1.5 py-1">
          <span className="text-sm font-medium text-foreground">
            {username}
          </span>
          <span className="text-xs font-normal text-muted-foreground">
            {roleLabel}
          </span>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={!profileHref}
          render={profileHref ? <Link href={profileHref} /> : undefined}
        >
          <User />
          Profil
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          disabled={isPending}
          onClick={() => startTransition(() => logoutAction())}
        >
          <LogOut />
          Keluar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
