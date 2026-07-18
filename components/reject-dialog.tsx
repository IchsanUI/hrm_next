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

type RejectFormState = { error?: string } | undefined

export function RejectDialog({
  requestId,
  applicant,
  title,
  successMessage,
  rejectAction,
}: {
  requestId: number
  applicant: string
  title: string
  successMessage: string
  rejectAction: (
    requestId: number,
    prevState: RejectFormState,
    formData: FormData
  ) => Promise<RejectFormState>
}) {
  const [open, setOpen] = useState(false)
  const action = rejectAction.bind(null, requestId)
  const [state, formAction, isPending] = useActionState<RejectFormState, FormData>(
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
      <Button size="sm" variant="destructive" onClick={() => setOpen(true)}>
        Tolak
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              Berikan alasan penolakan untuk pengajuan {applicant}.
            </DialogDescription>
          </DialogHeader>
          <form action={formAction} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor={`rejectionReason-${requestId}`}>Alasan Penolakan</Label>
              <Textarea
                id={`rejectionReason-${requestId}`}
                name="rejectionReason"
                placeholder="Jelaskan alasan penolakan"
                required
              />
            </div>
            {state?.error ? (
              <p className="text-destructive text-sm">{state.error}</p>
            ) : null}
            <DialogFooter>
              <Button type="submit" variant="destructive" disabled={isPending}>
                {isPending ? "Menyimpan..." : "Tolak Pengajuan"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
