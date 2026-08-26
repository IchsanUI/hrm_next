"use client"

import { useActionState, useEffect } from "react"
import { toast } from "sonner"

import {
  createSickLeaveRequestAction,
  type SickLeaveFormState,
} from "@/server/actions/sick-leave"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

function todayDateInputValue() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function SickLeaveRequestForm({
  colleagues,
  disabledReason,
}: {
  colleagues: { id: number; fullName: string; position: { name: string } }[]
  disabledReason?: string | null
}) {
  const [state, formAction, isPending] = useActionState<SickLeaveFormState, FormData>(
    createSickLeaveRequestAction,
    undefined
  )

  useEffect(() => {
    if (state?.error) toast.error(state.error)
  }, [state])

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle>Form Pengajuan Izin Sakit</CardTitle>
        <CardDescription>
          Isi tanggal dan alasan sakit Anda. Setelah diajukan, Anda wajib
          melengkapi Surat Keterangan Sakit/Dokter di halaman detail —
          boleh menyusul, tidak menghalangi proses approval.
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
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="startDate">Tanggal Mulai</Label>
              <Input
                id="startDate"
                name="startDate"
                type="date"
                min={todayDateInputValue()}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="endDate">Tanggal Selesai</Label>
              <Input
                id="endDate"
                name="endDate"
                type="date"
                min={todayDateInputValue()}
                required
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="reason">Alasan/Deskripsi Sakit</Label>
            <Textarea
              id="reason"
              name="reason"
              placeholder="Jelaskan kondisi sakit Anda"
              required
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="substituteEmployeeId">Pegawai Pengganti (opsional)</Label>
            <select
              id="substituteEmployeeId"
              name="substituteEmployeeId"
              defaultValue=""
              className="h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm dark:bg-input/30"
            >
              <option value="">Tidak ada pengganti</option>
              {colleagues.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.fullName} — {c.position.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              Pengganti berhak menyatakan tidak bersedia — kalau itu terjadi,
              Anda akan diminta memilih pengganti baru.
            </p>
          </div>

          {state?.error ? (
            <p className="text-destructive text-sm">{state.error}</p>
          ) : null}
          <div>
            <Button type="submit" disabled={isPending || !!disabledReason}>
              {isPending ? "Mengirim..." : "Ajukan Izin Sakit"}
            </Button>
          </div>
          </fieldset>
        </form>
      </CardContent>
    </Card>
  )
}
