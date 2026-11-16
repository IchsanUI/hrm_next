"use client"

import { useState } from "react"
import Image from "next/image"

import { APP_VERSION } from "@/lib/app-version"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

// Badge versi di sidebar. Diklik → jendela "Tentang Aplikasi" (satu-satunya
// tempat nama pembuat terlihat di antarmuka, dan hanya kalau dicari).
export function AboutAppBadge() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Tentang Aplikasi"
        className="rounded-full border border-white/15 bg-white/5 px-1.5 py-px text-[10px] font-medium text-white/60 tabular-nums transition-colors hover:border-white/30 hover:text-white/90"
      >
        v{APP_VERSION}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader className="items-center text-center">
            <span className="mb-2 flex size-16 items-center justify-center rounded-2xl bg-blue-950">
              <Image src="/LogoSystemWhite.png" alt="Logo" width={40} height={40} />
            </span>
            <DialogTitle>HRIS</DialogTitle>
            <DialogDescription>Human Resource Information System</DialogDescription>
          </DialogHeader>

          <dl className="grid gap-2 rounded-lg border px-4 py-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Versi</dt>
              <dd className="font-medium tabular-nums">{APP_VERSION}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Instansi</dt>
              <dd className="text-right font-medium">Perumda BPR Bank Gresik</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Dikembangkan oleh</dt>
              <dd className="text-right font-medium">Mochammad Ichsan</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Unit</dt>
              <dd className="text-right font-medium">EDP/IT</dd>
            </div>
          </dl>

          <p className="text-center text-xs text-muted-foreground">
            Copyright &copy; 2025 EDP/IT Bank Gresik
          </p>
        </DialogContent>
      </Dialog>
    </>
  )
}
