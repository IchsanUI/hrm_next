"use client"

import { useTransition } from "react"
import Link from "next/link"
import { LogOut, User } from "lucide-react"

import { logoutAction } from "@/server/actions/logout"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

// Menu akun di topbar: avatar + nama (nama disembunyikan di layar kecil),
// dropdown berisi identitas lengkap, Profil, dan Keluar.
export function UserMenu({
  username,
  displayName,
  positionLabel,
  roleLabel,
  profileHref,
  avatarUrl,
}: {
  username: string
  displayName?: string
  positionLabel?: string | null
  roleLabel: string
  profileHref?: string
  avatarUrl?: string | null
}) {
  const [isPending, startTransition] = useTransition()
  const name = displayName || username
  const initial = name.slice(0, 1).toUpperCase()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" className="h-auto gap-2 px-1.5 py-1" aria-label={`Menu pengguna ${name}`} />}
      >
        <Avatar size="sm">
          {avatarUrl ? <AvatarImage src={avatarUrl} alt={name} /> : null}
          <AvatarFallback>{initial}</AvatarFallback>
        </Avatar>
        <span className="hidden max-w-48 truncate text-sm font-medium sm:block">{name}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <div className="flex items-center gap-2.5 px-2 py-2">
          <Avatar>
            {avatarUrl ? <AvatarImage src={avatarUrl} alt={name} /> : null}
            <AvatarFallback>{initial}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-medium">{name}</p>
            {positionLabel ? <p className="truncate text-xs text-muted-foreground">{positionLabel}</p> : null}
            <p className="truncate text-xs text-muted-foreground">
              {roleLabel} · {username}
            </p>
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={!profileHref} render={profileHref ? <Link href={profileHref} /> : undefined}>
          <User />
          Profil
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" disabled={isPending} onClick={() => startTransition(() => logoutAction())}>
          <LogOut />
          Keluar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
