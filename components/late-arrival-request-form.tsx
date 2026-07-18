"use client"

import { useActionState, useEffect } from "react"
import { toast } from "sonner"

import {
  createLateArrivalRequestAction,
  type LateArrivalFormState,
} from "@/server/actions/late-arrival"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

export function LateArrivalRequestForm() {
  const [state, formAction, isPending] = useActionState<LateArrivalFormState, FormData>(
    createLateArrivalRequestAction,
    undefined
  )

  useEffect(() => {
    if (state?.error) toast.error(state.error)
  }, [state])

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle>Form Pengajuan Izin Terlambat</CardTitle>
        <CardDescription>
          Ajukan sekarang juga kalau Anda masih dalam perjalanan dan akan
          terlambat. Setelah tiba di kantor, Anda tetap wajib konfirmasi
          kedatangan di sistem dan absen fingerprint seperti biasa.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="reason">Alasan Keterlambatan</Label>
            <Textarea
              id="reason"
              name="reason"
              placeholder="Jelaskan kondisi yang membuat Anda terlambat (mis. macet, ban bocor)"
              required
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="evidence">Foto Bukti Kondisi</Label>
            <Input id="evidence" name="evidence" type="file" accept="image/*,.pdf" required />
          </div>

          {state?.error ? (
            <p className="text-destructive text-sm">{state.error}</p>
          ) : null}
          <div>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Mengirim..." : "Ajukan Izin Terlambat"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
