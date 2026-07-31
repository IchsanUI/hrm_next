"use client"

import { useActionState, useEffect } from "react"
import { toast } from "sonner"

import { createOvertimeRequestAction, type OvertimeFormState } from "@/server/actions/overtime"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { LocationRequiredField, useRequiredLocation } from "@/components/location-required-field"

function todayDateInputValue() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function OvertimeRequestForm({
  disabledReason,
}: {
  disabledReason?: string | null
}) {
  const [state, formAction, isPending] = useActionState<OvertimeFormState, FormData>(
    createOvertimeRequestAction,
    undefined
  )
  const { location, retryLocation } = useRequiredLocation()

  useEffect(() => {
    if (state?.error) toast.error(state.error)
  }, [state])

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle>Form Pengajuan Izin Lembur</CardTitle>
        <CardDescription>
          Isi rencana lembur Anda. Pengajuan akan dikirim ke atasan langsung
          untuk disetujui sebelum lembur dilaksanakan.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {disabledReason ? (
          <p className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {disabledReason}
          </p>
        ) : null}
        <form action={formAction} className="grid gap-4">
          <fieldset disabled={!!disabledReason} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="date">Tanggal Lembur</Label>
            <Input id="date" name="date" type="date" min={todayDateInputValue()} required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="task">Tugas Lembur</Label>
            <Textarea
              id="task"
              name="task"
              placeholder="Jelaskan pekerjaan yang akan dikerjakan saat lembur"
              required
            />
          </div>

          <LocationRequiredField location={location} onRetry={retryLocation} />

          {state?.error ? (
            <p className="text-destructive text-sm">{state.error}</p>
          ) : null}
          <div>
            <Button
              type="submit"
              disabled={isPending || !!disabledReason || location.status !== "granted"}
            >
              {isPending ? "Mengirim..." : "Ajukan Izin Lembur"}
            </Button>
          </div>
          </fieldset>
        </form>
      </CardContent>
    </Card>
  )
}
