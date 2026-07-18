"use client"

import { useActionState, useEffect, useState } from "react"
import Image from "next/image"
import { toast } from "sonner"

import type { PhotoUploadState } from "@/server/actions/employee-photo"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

// Server action body limit dinaikkan ke 5mb (next.config.ts), tapi tetap
// dicek di client dulu supaya file yang kelewat besar tidak sampai bikin
// Next.js melempar "Body exceeded limit" mentah-mentah — cukup alert biasa.
const MAX_FILE_SIZE_BYTES = 4 * 1024 * 1024

export function EmployeeImageUpload({
  label,
  fieldName,
  action,
  currentUrl,
  width = 80,
  height = 80,
  imageClassName = "size-20 rounded-md object-cover",
  emptyLabel = "Belum ada",
}: {
  label: string
  fieldName: string
  action: (
    state: PhotoUploadState,
    formData: FormData
  ) => Promise<PhotoUploadState>
  currentUrl: string | null
  width?: number
  height?: number
  imageClassName?: string
  emptyLabel?: string
}) {
  const [state, formAction, isPending] = useActionState(action, undefined)
  const [sizeError, setSizeError] = useState<string | null>(null)

  useEffect(() => {
    if (state?.success) {
      toast.success(`${label} berhasil diunggah.`)
    } else if (state?.error) {
      toast.error(state.error)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    const input = e.currentTarget.elements.namedItem(fieldName) as HTMLInputElement | null
    const file = input?.files?.[0]
    if (file && file.size > MAX_FILE_SIZE_BYTES) {
      e.preventDefault()
      const maxMb = MAX_FILE_SIZE_BYTES / (1024 * 1024)
      const message = `Ukuran file maksimal ${maxMb}MB. File yang dipilih berukuran ${(file.size / (1024 * 1024)).toFixed(1)}MB.`
      setSizeError(message)
      alert(message)
      return
    }
    setSizeError(null)
  }

  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {currentUrl ? (
        <Image
          src={currentUrl}
          alt={label}
          width={width}
          height={height}
          style={{ width, height }}
          className={imageClassName}
        />
      ) : (
        <div
          style={{ width, height }}
          className="flex items-center justify-center rounded-md border border-dashed bg-muted text-center text-xs text-muted-foreground"
        >
          {emptyLabel}
        </div>
      )}
      <form
        action={formAction}
        onSubmit={handleSubmit}
        className="flex w-full max-w-[220px] flex-col gap-2"
      >
        <Input
          type="file"
          name={fieldName}
          accept="image/*"
          required
          onChange={() => setSizeError(null)}
          className="text-xs"
        />
        <Button
          type="submit"
          disabled={isPending}
          variant="outline"
          size="sm"
          className="w-full"
        >
          {isPending ? "Mengunggah..." : "Unggah"}
        </Button>
        {sizeError ? (
          <p className="text-destructive text-sm">{sizeError}</p>
        ) : state?.error ? (
          <p className="text-destructive text-sm">{state.error}</p>
        ) : null}
      </form>
    </div>
  )
}
