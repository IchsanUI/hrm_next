"use client"

import { useActionState, useEffect } from "react"
import { toast } from "sonner"

import {
  createOffSiteAttendanceRequestAction,
  type OffSiteAttendanceFormState,
} from "@/server/actions/off-site-attendance"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { LocationRequiredField, useRequiredLocation } from "@/components/location-required-field"

function todayDateValue() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
}

export function OffSiteAttendanceRequestForm({
  disabledReason,
}: {
  disabledReason?: string | null
}) {
  const [state, formAction, isPending] = useActionState<OffSiteAttendanceFormState, FormData>(
    createOffSiteAttendanceRequestAction,
    undefined
  )
  const { location, retryLocation } = useRequiredLocation()

  useEffect(() => {
    if (state?.error) toast.error(state.error)
  }, [state])

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle>Form Pengajuan Izin Absen Diluar Kantor</CardTitle>
        <CardDescription>
          Isi kalau Anda sedang/akan dinas atau bekerja di luar kantor
          sehingga tidak bisa absen fingerprint di kantor. Pengajuan akan
          dikirim ke atasan langsung untuk disetujui.
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
              <Label htmlFor="date">Tanggal</Label>
              <Input id="date" name="date" type="date" defaultValue={todayDateValue()} required />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="location">Lokasi Kerja di Luar Kantor</Label>
              <Input
                id="location"
                name="location"
                placeholder="mis. Kantor Cabang Bungah / Rumah Nasabah Bpk. Ahmad"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="reason">Keperluan</Label>
              <Textarea
                id="reason"
                name="reason"
                placeholder="Jelaskan keperluan Anda bekerja di luar kantor"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="evidence">Bukti Pendukung</Label>
              <Input id="evidence" name="evidence" type="file" accept="image/*,.pdf" required />
              <p className="text-xs text-muted-foreground">
                Wajib — mis. surat tugas atau foto lokasi kerja.
              </p>
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
                {isPending ? "Mengirim..." : "Ajukan Izin Absen Diluar Kantor"}
              </Button>
            </div>
          </fieldset>
        </form>
      </CardContent>
    </Card>
  )
}
