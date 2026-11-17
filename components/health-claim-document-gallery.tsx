"use client"

import { useState } from "react"
import { ChevronLeft, ChevronRight, ExternalLink, FileText } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"

export type GalleryDocument = { publicId: string; originalName: string; isPdf: boolean }

const fileUrl = (publicId: string) => `/api/klaim-kesehatan/dokumen/${publicId}`

// Bukti klaim sebagai thumbnail; klik untuk melihat di popup (gambar atau
// PDF), dengan navigasi antar-bukti. File selalu disajikan lewat route yang
// mengecek akses & memberi watermark.
export function HealthClaimDocumentGallery({ documents }: { documents: GalleryDocument[] }) {
  const [index, setIndex] = useState<number | null>(null)
  const current = index === null ? null : documents[index]

  if (documents.length === 0) return <p className="text-sm text-muted-foreground">Tidak ada bukti.</p>

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        {documents.map((doc, i) => (
          <button
            key={doc.publicId}
            type="button"
            onClick={() => setIndex(i)}
            className="group min-w-0 text-left"
            aria-label={`Lihat ${doc.originalName}`}
          >
            <div className="flex aspect-[3/4] items-center justify-center overflow-hidden rounded-md border bg-muted/40 transition-shadow group-hover:ring-2 group-hover:ring-primary">
              {doc.isPdf ? (
                <span className="flex flex-col items-center gap-1 text-muted-foreground">
                  <FileText className="size-8" />
                  <span className="text-xs font-semibold">PDF</span>
                </span>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element -- file terproteksi (lewat route berotorisasi), bukan aset statis
                <img src={fileUrl(doc.publicId)} alt={doc.originalName} loading="lazy" className="h-full w-full object-cover" />
              )}
            </div>
            <p className="mt-1 truncate text-xs" title={doc.originalName}>
              {doc.originalName}
            </p>
          </button>
        ))}
      </div>

      <Dialog open={current !== null} onOpenChange={(open) => !open && setIndex(null)}>
        <DialogContent className="flex max-h-[92vh] flex-col gap-3 sm:max-w-4xl">
          {current ? (
            <>
              <DialogHeader>
                <DialogTitle className="truncate pr-8">{current.originalName}</DialogTitle>
                <DialogDescription>
                  Bukti {index! + 1} dari {documents.length}
                </DialogDescription>
              </DialogHeader>
              <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto rounded-md border bg-muted/30">
                {current.isPdf ? (
                  <iframe src={fileUrl(current.publicId)} title={current.originalName} className="h-[70vh] w-full bg-white" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element -- file terproteksi (lewat route berotorisasi), bukan aset statis
                  <img src={fileUrl(current.publicId)} alt={current.originalName} className="max-h-[70vh] w-auto object-contain" />
                )}
              </div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={index === 0}
                    onClick={() => setIndex((i) => (i === null ? i : i - 1))}
                  >
                    <ChevronLeft className="size-4" />
                    Sebelumnya
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={index === documents.length - 1}
                    onClick={() => setIndex((i) => (i === null ? i : i + 1))}
                  >
                    Berikutnya
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  render={<a href={fileUrl(current.publicId)} target="_blank" rel="noopener noreferrer" />}
                  nativeButton={false}
                >
                  <ExternalLink className="size-4" />
                  Buka di tab baru
                </Button>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
}
