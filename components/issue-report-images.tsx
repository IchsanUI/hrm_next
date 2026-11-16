"use client"

import { useState } from "react"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

// Galeri thumbnail screenshot laporan — klik untuk melihat ukuran penuh.
export function IssueReportImages({
  urls,
  size = "md",
}: {
  urls: string[]
  size?: "sm" | "md"
}) {
  const [active, setActive] = useState<string | null>(null)
  if (urls.length === 0) return null

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {urls.map((url, index) => (
          <button
            key={url}
            type="button"
            onClick={() => setActive(url)}
            className="overflow-hidden rounded-md border transition hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={`Lihat screenshot ${index + 1}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt={`Screenshot ${index + 1}`} className={size === "sm" ? "size-14 object-cover" : "size-20 object-cover"} />
          </button>
        ))}
      </div>
      <Dialog open={active !== null} onOpenChange={(open) => !open && setActive(null)}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Screenshot</DialogTitle>
          </DialogHeader>
          {active ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={active} alt="Screenshot kendala" className="max-h-[75vh] w-full rounded-md object-contain" />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
}
