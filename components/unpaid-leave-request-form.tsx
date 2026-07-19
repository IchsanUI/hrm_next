"use client"

import { useActionState, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Lock } from "lucide-react"

import {
  createUnpaidLeaveRequestAction,
  type UnpaidLeaveFormState,
} from "@/server/actions/unpaid-leave"
import {
  minUnpaidLeaveStartDate,
  maxUnpaidLeaveEndDate,
  UNPAID_LEAVE_MIN_TENURE_YEARS,
  UNPAID_LEAVE_MIN_NOTICE_MONTHS,
  UNPAID_LEAVE_MAX_MONTHS,
  type UnpaidLeaveEligibility,
} from "@/lib/validations/unpaid-leave"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

export function UnpaidLeaveRequestForm({
  colleagues,
  tenureYears,
  eligibility,
}: {
  colleagues: { id: number; fullName: string; position: { name: string } }[]
  tenureYears: number
  eligibility: UnpaidLeaveEligibility
}) {
  const [state, formAction, isPending] = useActionState<UnpaidLeaveFormState, FormData>(
    createUnpaidLeaveRequestAction,
    undefined
  )
  const minStartDate = useMemo(() => minUnpaidLeaveStartDate(), [])
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")

  useEffect(() => {
    if (state?.error) toast.error(state.error)
  }, [state])

  const maxEndDate = useMemo(() => {
    if (!startDate) return ""
    return maxUnpaidLeaveEndDate(startDate)
  }, [startDate])

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>Form Pengajuan Cuti Di Luar Tanggungan Perusahaan</CardTitle>
        <CardDescription>
          Sesuai Pasal 39 — untuk pegawai masa kerja ≥{UNPAID_LEAVE_MIN_TENURE_YEARS}{" "}
          tahun terus-menerus, diajukan minimal {UNPAID_LEAVE_MIN_NOTICE_MONTHS} bulan
          sebelumnya, durasi maksimal {UNPAID_LEAVE_MAX_MONTHS} bulan.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4 grid gap-1 rounded-md border border-primary/20 bg-primary/5 p-2.5 text-xs">
          <p>
            Masa kerja Anda saat ini: <span className="font-semibold">{tenureYears} tahun</span>
          </p>
          <p className="text-muted-foreground">
            Selama cuti ini: tidak dihitung sebagai masa kerja, tidak
            mendapat gaji/tunjangan, dibebastugaskan dari jabatan sebelumnya
            (tidak berhak menuntut jabatan sebelumnya), dan tetap wajib
            membayar kewajiban Jamsostek/Asuransi.
          </p>
        </div>

        {!eligibility.eligible ? (
          <div className="flex items-start gap-2.5 rounded-md border border-dashed border-muted-foreground/30 bg-muted/40 p-4 text-sm">
            <Lock className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div>
              <p className="font-medium">Belum bisa mengajukan Cuti Di Luar Tanggungan</p>
              <p className="mt-1 text-muted-foreground">{eligibility.reason}</p>
            </div>
          </div>
        ) : (
          <form action={formAction} className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="startDate">Tanggal Mulai</Label>
                <Input
                  id="startDate"
                  name="startDate"
                  type="date"
                  min={minStartDate}
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value)
                    setEndDate("")
                  }}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Paling cepat {UNPAID_LEAVE_MIN_NOTICE_MONTHS} bulan dari hari ini.
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="endDate">Tanggal Selesai</Label>
                <Input
                  id="endDate"
                  name="endDate"
                  type="date"
                  min={startDate || minStartDate}
                  max={maxEndDate || undefined}
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  required
                  disabled={!startDate}
                />
                {maxEndDate ? (
                  <p className="text-xs text-muted-foreground">
                    Maksimal sampai {maxEndDate} ({UNPAID_LEAVE_MAX_MONTHS} bulan).
                  </p>
                ) : null}
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="reason">Alasan</Label>
              <Textarea
                id="reason"
                name="reason"
                placeholder="Jelaskan alasan pengajuan cuti di luar tanggungan"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="substituteEmployeeId">Pegawai Pengganti (opsional)</Label>
              <select
                id="substituteEmployeeId"
                name="substituteEmployeeId"
                defaultValue=""
                className="h-9 rounded-lg border border-input bg-transparent px-3 text-sm dark:bg-input/30"
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

            <div className="grid gap-2">
              <Label htmlFor="supportingDocument">Dokumen Pendukung (opsional)</Label>
              <Input
                id="supportingDocument"
                name="supportingDocument"
                type="file"
                accept="image/*,.pdf"
              />
            </div>

            {state?.error ? (
              <p className="text-destructive text-sm">{state.error}</p>
            ) : null}
            <div>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Mengirim..." : "Ajukan Cuti"}
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  )
}
