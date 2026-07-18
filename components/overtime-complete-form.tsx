"use client"

import { useActionState, useEffect, useRef } from "react"
import { toast } from "sonner"
import { ClipboardCheck } from "lucide-react"

import {
  completeOvertimeRequestAction,
  type OvertimeFormState,
} from "@/server/actions/overtime"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export function OvertimeCompleteForm({ requestId }: { requestId: number }) {
  const action = completeOvertimeRequestAction.bind(null, requestId)
  const [state, formAction, isPending] = useActionState<OvertimeFormState, FormData>(
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
    toast.success("Hasil lembur berhasil dilengkapi.")
  }, [isPending, state])

  return (
    <Card>
      <CardHeader className="flex items-start gap-3 border-b">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <ClipboardCheck className="size-4.5" />
        </span>
        <div>
          <CardTitle>Lengkapi Hasil Lembur</CardTitle>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Tahap 2 dari 2 — isi jam aktual, hasil, dan bukti lembur yang sudah dilaksanakan.
          </p>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        <form action={formAction} className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor={`actualStartTime-${requestId}`}>Jam Mulai</Label>
              <Input
                id={`actualStartTime-${requestId}`}
                name="actualStartTime"
                type="time"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`actualEndTime-${requestId}`}>Jam Selesai</Label>
              <Input
                id={`actualEndTime-${requestId}`}
                name="actualEndTime"
                type="time"
                required
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`resultDescription-${requestId}`}>Deskripsi Lembur</Label>
            <Textarea
              id={`resultDescription-${requestId}`}
              name="resultDescription"
              placeholder="Jelaskan pekerjaan yang sudah dikerjakan saat lembur"
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`proof-${requestId}`}>Bukti Lembur</Label>
            <Input id={`proof-${requestId}`} name="proof" type="file" required />
          </div>
          {state?.error ? (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {state.error}
            </p>
          ) : null}
          <div className="flex justify-end">
            <Button type="submit" disabled={isPending}>
              {isPending ? "Menyimpan..." : "Simpan Hasil Lembur"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
