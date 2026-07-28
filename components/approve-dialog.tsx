"use client"

import { useActionState, useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"

type ApproveFormState = { error?: string } | undefined

export function ApproveDialog({
  requestId,
  applicant,
  title,
  description,
  successMessage,
  actionLabel,
  approveAction,
}: {
  requestId: number
  applicant: string
  title: string
  description?: string
  successMessage: string
  actionLabel?: string
  approveAction: (
    requestId: number,
    prevState: ApproveFormState,
    formData: FormData
  ) => Promise<ApproveFormState>
}) {
  const [open, setOpen] = useState(false)
  const action = approveAction.bind(null, requestId)
  const [state, formAction, isPending] = useActionState<ApproveFormState, FormData>(
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
    toast.success(successMessage)
    const id = setTimeout(() => setOpen(false), 0)
    return () => clearTimeout(id)
  }, [isPending, state, successMessage])

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        {actionLabel ?? "Setujui"}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              {description ?? `Konfirmasi persetujuan untuk pengajuan ${applicant}.`}
            </DialogDescription>
          </DialogHeader>
          <form action={formAction} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor={`catatan-${requestId}`}>Catatan / Pertimbangan (opsional)</Label>
              <Textarea
                id={`catatan-${requestId}`}
                name="catatan"
                placeholder="Tulis catatan atau pertimbangan sebelum menyetujui (opsional)"
              />
            </div>
            {state?.error ? (
              <p className="text-destructive text-sm">{state.error}</p>
            ) : null}
            <DialogFooter>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Menyimpan..." : (actionLabel ?? "Setujui")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
