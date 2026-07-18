"use client"

import { useActionState, useEffect } from "react"
import { toast } from "sonner"

import {
  createEarlyLeaveRequestAction,
  type EarlyLeaveFormState,
} from "@/server/actions/early-leave"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

export function EarlyLeaveRequestForm() {
  const [state, formAction, isPending] = useActionState<EarlyLeaveFormState, FormData>(
    createEarlyLeaveRequestAction,
    undefined
  )

  useEffect(() => {
    if (state?.error) toast.error(state.error)
  }, [state])

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle>Form Pengajuan Izin Pulang Cepat</CardTitle>
        <CardDescription>
          Isi rencana pulang cepat Anda. Pengajuan akan mengikuti alur approval
          yang sudah diatur di menu Alur Approval.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="plannedLeaveTime">Rencana Pulang Cepat Jam Berapa</Label>
            <Input id="plannedLeaveTime" name="plannedLeaveTime" type="time" required />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="detail">Detail Keperluan</Label>
            <Textarea
              id="detail"
              name="detail"
              placeholder="Jelaskan keperluan Anda pulang cepat"
              required
            />
          </div>

          {state?.error ? (
            <p className="text-destructive text-sm">{state.error}</p>
          ) : null}
          <div>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Mengirim..." : "Ajukan Izin Pulang Cepat"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
