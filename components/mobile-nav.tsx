"use client"

import { useState } from "react"
import Image from "next/image"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { Menu, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { DashboardNav, type NavEntry } from "@/components/dashboard-nav"
import { SidebarVersion } from "@/components/sidebar-version"

export function MobileNav({ navItems }: { navItems: NavEntry[] }) {
  const [open, setOpen] = useState(false)

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-label="Buka menu"
          />
        }
      >
        <Menu className="size-5" />
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop
          className={cn(
            "fixed inset-0 z-50 bg-black/30 duration-150",
            "data-open:animate-in data-open:fade-in-0",
            "data-closed:animate-out data-closed:fade-out-0"
          )}
        />
        <DialogPrimitive.Popup
          className={cn(
            "fixed inset-y-0 left-0 z-50 flex h-full w-72 max-w-[80vw] flex-col gap-1 overflow-y-auto border-r border-white/10 bg-blue-950 p-4 shadow-lg outline-none duration-200",
            "data-open:animate-in data-open:slide-in-from-left",
            "data-closed:animate-out data-closed:slide-out-to-left"
          )}
        >
          <div className="mb-4 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Image
                src="/LogoSystemWhite.png"
                alt="Logo"
                width={26}
                height={26}
                className="shrink-0"
              />
              <span className="text-lg font-bold text-white">HRM</span>
            </span>
            <DialogPrimitive.Close
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Tutup menu"
                  className="text-white hover:bg-white/10 hover:text-white"
                />
              }
            >
              <X className="size-4" />
            </DialogPrimitive.Close>
          </div>
          <DashboardNav items={navItems} onNavigate={() => setOpen(false)} />
          <SidebarVersion />
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
