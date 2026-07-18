"use client"

import { useActionState, useEffect, useRef } from "react"
import { toast } from "sonner"

import {
  uploadSickLeaveCertificateAction,
  type SickLeaveFormState,
} from "@/server/actions/sick-leave"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function SickLeaveCertificateUpload({ requestId }: { requestId: number }) {
  const action = uploadSickLeaveCertificateAction.bind(null, requestId)
  const [state, formAction, isPending] = useActionState<SickLeaveFormState, FormData>(
    action,
    undefined
  )
  const wasPending = useRef(false)

  useEffect(() => {
    if (!wasPending.current || isPending) {
      wasPending.current = isPending
      return
    }
    wasPending.current = isPending
    if (state?.error) {
      toast.error(state.error)
      return
    }
    toast.success("Surat keterangan sakit berhasil diunggah.")
  }, [isPending, state])

  return (
    <form action={formAction} className="grid gap-2">
      <Label htmlFor={`certificate-${requestId}`}>Surat Keterangan Sakit/Dokter</Label>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          id={`certificate-${requestId}`}
          name="certificate"
          type="file"
          accept="image/*,.pdf"
          required
          className="max-w-xs"
        />
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "Mengunggah..." : "Unggah"}
        </Button>
      </div>
      {state?.error ? <p className="text-destructive text-sm">{state.error}</p> : null}
    </form>
  )
}
