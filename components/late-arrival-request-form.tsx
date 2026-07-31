"use client"

import { useState, useTransition, type FormEvent } from "react"
import { toast } from "sonner"

import {
  createLateArrivalRequestAction,
  type LateArrivalFormState,
} from "@/server/actions/late-arrival"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { CameraCaptureInput } from "@/components/camera-capture-input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { LocationRequiredField, useRequiredLocation } from "@/components/location-required-field"

export function LateArrivalRequestForm({
  disabledReason,
}: {
  disabledReason?: string | null
}) {
  const [state, setState] = useState<LateArrivalFormState>(undefined)
  const [isPending, startTransition] = useTransition()
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([])
  const { location, retryLocation } = useRequiredLocation()

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (evidenceFiles.length === 0) {
      toast.error("Foto bukti kondisi wajib diambil.")
      return
    }
    if (location.status !== "granted") {
      toast.error("Lokasi wajib diaktifkan untuk mengajukan izin ini.")
      return
    }

    const formData = new FormData(event.currentTarget)
    formData.append("evidence", evidenceFiles[0])

    startTransition(async () => {
      const result = await createLateArrivalRequestAction(undefined, formData)
      setState(result)
      if (result?.error) toast.error(result.error)
    })
  }

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
        {disabledReason ? (
          <p className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {disabledReason}
          </p>
        ) : null}
        <form onSubmit={handleSubmit} className="grid gap-4">
          <fieldset disabled={!!disabledReason} className="grid gap-4">
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
            <Label>Foto Bukti Kondisi</Label>
            <CameraCaptureInput files={evidenceFiles} onChange={setEvidenceFiles} multiple={false} />
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
              {isPending ? "Mengirim..." : "Ajukan Izin Terlambat"}
            </Button>
          </div>
          </fieldset>
        </form>
      </CardContent>
    </Card>
  )
}
