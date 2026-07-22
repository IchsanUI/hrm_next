"use client"

import { useActionState, useEffect } from "react"
import { toast } from "sonner"

import {
  createAttendanceStatementRequestAction,
  type AttendanceStatementFormState,
} from "@/server/actions/attendance-statement"
import {
  ATTENDANCE_STATEMENT_ACKNOWLEDGEMENTS,
  MISSED_ATTENDANCE_TYPES,
  MISSED_ATTENDANCE_TYPE_LABEL,
} from "@/lib/validations/attendance-statement"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

function todayDateValue() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
}

export function AttendanceStatementRequestForm({
  disabledReason,
}: {
  disabledReason?: string | null
}) {
  const [state, formAction, isPending] = useActionState<AttendanceStatementFormState, FormData>(
    createAttendanceStatementRequestAction,
    undefined
  )

  useEffect(() => {
    if (state?.error) toast.error(state.error)
  }, [state])

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle>Form Pernyataan Tidak Absen Datang/Pulang</CardTitle>
        <CardDescription>
          Isi kalau Anda lupa/lalai melakukan presensi fingerprint (datang
          dan/atau pulang). Ini bukan pengajuan izin sebelumnya, melainkan
          pernyataan resmi yang akan diteruskan ke atasan langsung dan
          Direksi.
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
              <Label htmlFor="date">Tanggal Kejadian</Label>
              <Input
                id="date"
                name="date"
                type="date"
                max={todayDateValue()}
                defaultValue={todayDateValue()}
                required
              />
            </div>

            <div className="grid gap-2">
              <Label>Jenis</Label>
              <div className="flex flex-wrap gap-4">
                {MISSED_ATTENDANCE_TYPES.map((value) => (
                  <label key={value} className="flex items-center gap-1.5 text-sm">
                    <input
                      type="radio"
                      name="missedType"
                      value={value}
                      defaultChecked={value === "KEDUANYA"}
                      required
                    />
                    {MISSED_ATTENDANCE_TYPE_LABEL[value]}
                  </label>
                ))}
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="reason">Alasan</Label>
              <Textarea
                id="reason"
                name="reason"
                placeholder="Jelaskan alasan Anda lupa/lalai melakukan presensi"
                required
              />
            </div>

            <div className="grid gap-2 rounded-lg border p-3">
              <p className="text-sm font-medium">Pernyataan</p>
              {ATTENDANCE_STATEMENT_ACKNOWLEDGEMENTS.map((ack) => (
                <label key={ack.field} className="flex items-start gap-2 text-sm">
                  <input type="checkbox" name={ack.field} className="mt-0.5" required />
                  <span>{ack.label}</span>
                </label>
              ))}
            </div>

            {state?.error ? (
              <p className="text-destructive text-sm">{state.error}</p>
            ) : null}
            <div>
              <Button type="submit" disabled={isPending || !!disabledReason}>
                {isPending ? "Mengirim..." : "Ajukan Pernyataan"}
              </Button>
            </div>
          </fieldset>
        </form>
      </CardContent>
    </Card>
  )
}
