"use client"

import { useState } from "react"
import { Download, Eye, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"

// Pratinjau PDF Nota Dinas (surat + lampiran bukti nota) di popup.
export function MemoPdfPreviewButton({ pdfHref, memoNumber }: { pdfHref: string; memoNumber: string }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  return (
    <>
      <Button
        variant="outline"
        onClick={() => {
          setLoading(true)
          setOpen(true)
        }}
      >
        <Eye className="size-4" />
        Pratinjau
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex h-[92vh] max-h-[92vh] flex-col gap-3 sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>Nota Dinas {memoNumber}</DialogTitle>
            <DialogDescription>Surat Nota Dinas beserta lampiran bukti nota setiap klaim.</DialogDescription>
          </DialogHeader>
          <div className="relative min-h-0 flex-1 overflow-hidden rounded-md border bg-muted/30">
            {loading ? (
              <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Menyiapkan PDF...
              </div>
            ) : null}
            {open ? (
              <iframe
                src={pdfHref}
                title={`Nota Dinas ${memoNumber}`}
                className="h-full w-full bg-white"
                onLoad={() => setLoading(false)}
              />
            ) : null}
          </div>
          <div className="flex justify-end">
            <Button variant="outline" size="sm" render={<a href={`${pdfHref}?unduh=1`} />} nativeButton={false}>
              <Download className="size-4" />
              Unduh PDF
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
