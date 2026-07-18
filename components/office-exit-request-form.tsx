"use client"

import { useActionState, useEffect } from "react"
import { toast } from "sonner"

import {
  createOfficeExitRequestAction,
  type OfficeExitFormState,
} from "@/server/actions/office-exit"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

const CATEGORY_OPTIONS = [
  { value: "PRIBADI", label: "Urusan Pribadi" },
  { value: "DINAS", label: "Urusan Dinas" },
] as const

export function OfficeExitRequestForm() {
  const [state, formAction, isPending] = useActionState<OfficeExitFormState, FormData>(
    createOfficeExitRequestAction,
    undefined
  )

  useEffect(() => {
    if (state?.error) toast.error(state.error)
  }, [state])

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle>Form Pengajuan Izin Meninggalkan Kantor</CardTitle>
        <CardDescription>
          Isi rencana keluar kantor Anda. Pengajuan akan dikirim ke Kepala
          Departemen untuk disetujui sebelum Anda meninggalkan kantor.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="plannedExitTime">Rencana Jam Keluar</Label>
            <Input id="plannedExitTime" name="plannedExitTime" type="time" required />
          </div>

          <div className="grid gap-2">
            <Label>Kategori</Label>
            <div className="flex gap-4">
              {CATEGORY_OPTIONS.map((opt) => (
                <label key={opt.value} className="flex items-center gap-1.5 text-sm">
                  <input
                    type="radio"
                    name="category"
                    value={opt.value}
                    defaultChecked={opt.value === "PRIBADI"}
                    required
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="reason">Penjelasan Keluar</Label>
            <Textarea
              id="reason"
              name="reason"
              placeholder="Jelaskan keperluan Anda meninggalkan kantor"
              required
            />
          </div>

          {state?.error ? (
            <p className="text-destructive text-sm">{state.error}</p>
          ) : null}
          <div>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Mengirim..." : "Ajukan Izin Meninggalkan Kantor"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
