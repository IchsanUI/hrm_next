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

export function UserMenu({
  username,
  profileHref,
  avatarUrl,
}: {
  username: string
  // Diterima tapi sengaja tidak ditampilkan lagi di dropdown (permintaan
  // user: avatar-only, tanpa nama/status biar lebih rapi) — parameter
  // dipertahankan supaya pemanggil (DashboardTopbar) tidak perlu diubah.
  roleLabel: string
  profileHref?: string
  avatarUrl?: string | null
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
          {avatarUrl ? <AvatarImage src={avatarUrl} alt={username} /> : null}
          <AvatarFallback>{initial}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
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
