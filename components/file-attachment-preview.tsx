"use client"

import { useState } from "react"
import Link from "next/link"
import { FileImage, FileText, File as FileIcon, ExternalLink } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

type FileKind = "image" | "pdf" | "other"

const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"]

function getExtension(url: string) {
  const clean = url.split("?")[0].split("#")[0]
  const dot = clean.lastIndexOf(".")
  return dot === -1 ? "" : clean.slice(dot + 1).toLowerCase()
}

function getFileKind(url: string): FileKind {
  const ext = getExtension(url)
  if (IMAGE_EXTENSIONS.includes(ext)) return "image"
  if (ext === "pdf") return "pdf"
  return "other"
}

const KIND_ICON: Record<FileKind, typeof FileImage> = {
  image: FileImage,
  pdf: FileText,
  other: FileIcon,
}

const KIND_LABEL: Record<FileKind, string> = {
  image: "Gambar",
  pdf: "PDF",
  other: "File",
}

export function FileAttachmentPreview({
  url,
  label = "Lihat Dokumen",
}: {
  url: string
  label?: string
}) {
  const [open, setOpen] = useState(false)
  const kind = getFileKind(url)
  const Icon = KIND_ICON[kind]

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-0.5 inline-flex items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline"
      >
        <Icon className="size-3.5" />
        {label}
        <span className="text-xs font-normal text-muted-foreground">
          ({KIND_LABEL[kind]})
        </span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-1.5">
              <Icon className="size-4" />
              {label}
            </DialogTitle>
          </DialogHeader>

          {kind === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={url}
              alt={label}
              className="mx-auto max-h-[75vh] w-auto rounded-md border object-contain"
            />
          ) : kind === "pdf" ? (
            <iframe src={url} title={label} className="h-[75vh] w-full rounded-md border" />
          ) : (
            <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              Preview tidak didukung untuk tipe file ini. Buka file lewat tombol di bawah.
            </p>
          )}

          <DialogFooter>
            <Button variant="outline" render={<Link href={url} target="_blank" />} nativeButton={false}>
              <ExternalLink className="size-3.5" />
              Buka di Tab Baru
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
