"use client"

import { useActionState, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

import {
  createMaternityLeaveRequestAction,
  type MaternityLeaveFormState,
} from "@/server/actions/maternity-leave"
import { computeMaternityLeaveBreakdown } from "@/lib/validations/maternity-leave"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

function formatDateDisplay(iso: string) {
  return new Date(`${iso}T00:00:00.000Z`).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  })
}

export function MaternityLeaveRequestForm({
  colleagues,
}: {
  colleagues: { id: number; fullName: string; position: { name: string } }[]
}) {
  const [state, formAction, isPending] = useActionState<MaternityLeaveFormState, FormData>(
    createMaternityLeaveRequestAction,
    undefined
  )
  const [type, setType] = useState<"BERSALIN" | "GUGUR_KANDUNGAN">("BERSALIN")
  const [referenceDate, setReferenceDate] = useState("")

  useEffect(() => {
    if (state?.error) toast.error(state.error)
  }, [state])

  const breakdown = useMemo(() => {
    if (!referenceDate) return null
    return computeMaternityLeaveBreakdown(type, referenceDate)
  }, [type, referenceDate])

  const totalDays = useMemo(() => {
    if (!breakdown) return 0
    const start = new Date(`${breakdown.startDate}T00:00:00.000Z`)
    const end = new Date(`${breakdown.endDate}T00:00:00.000Z`)
    return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
  }, [breakdown])

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle>Form Pengajuan Cuti Bersalin / Gugur Kandungan</CardTitle>
        <CardDescription>
          Sesuai Pasal 37 — durasi dihitung otomatis (1,5 bulan ≈ 45 hari per
          sisi). Surat keterangan dokter wajib dilampirkan saat pengajuan.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="type">Jenis Cuti</Label>
            <select
              id="type"
              name="type"
              value={type}
              onChange={(e) => setType(e.target.value as "BERSALIN" | "GUGUR_KANDUNGAN")}
              className="h-9 rounded-lg border border-input bg-transparent px-3 text-sm dark:bg-input/30"
            >
              <option value="BERSALIN">Cuti Bersalin</option>
              <option value="GUGUR_KANDUNGAN">Cuti Gugur Kandungan</option>
            </select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="referenceDate">
              {type === "BERSALIN" ? "HPL (Tanggal Perkiraan Lahir)" : "Tanggal Kejadian"}
            </Label>
            <Input
              id="referenceDate"
              name="referenceDate"
              type="date"
              value={referenceDate}
              onChange={(e) => setReferenceDate(e.target.value)}
              required
            />
          </div>

          {breakdown ? (
            <div className="rounded-md border border-primary/20 bg-primary/5 p-3 text-xs">
              <p className="mb-2 font-medium text-foreground">Rincian Perhitungan Cuti</p>
              <div className="grid gap-1.5">
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">
                    {type === "BERSALIN" ? "Tanggal HPL" : "Tanggal Kejadian"}
                  </span>
                  <span className="font-medium">{formatDateDisplay(breakdown.referenceDate)}</span>
                </div>
                {breakdown.beforeRangeStart && breakdown.beforeRangeEnd ? (
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">1,5 Bulan Sebelum HPL</span>
                    <span className="font-medium">
                      {formatDateDisplay(breakdown.beforeRangeStart)} — {formatDateDisplay(breakdown.beforeRangeEnd)}
                    </span>
                  </div>
                ) : null}
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">
                    {type === "BERSALIN" ? "1,5 Bulan Setelah HPL" : "1,5 Bulan Setelahnya"}
                  </span>
                  <span className="font-medium">
                    {formatDateDisplay(breakdown.afterRangeStart)} — {formatDateDisplay(breakdown.afterRangeEnd)}
                  </span>
                </div>
              </div>
              <div className="mt-2 flex justify-between gap-2 border-t border-primary/20 pt-2">
                <span className="font-medium">Total Cuti</span>
                <span className="font-semibold">{totalDays} hari</span>
              </div>
            </div>
          ) : null}

          <div className="grid gap-2">
            <Label htmlFor="reason">Keterangan (opsional)</Label>
            <Textarea id="reason" name="reason" placeholder="Catatan tambahan (opsional)" />
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
            <Label htmlFor="supportingDocument">Surat Keterangan Dokter</Label>
            <Input
              id="supportingDocument"
              name="supportingDocument"
              type="file"
              accept="image/*,.pdf"
              required
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
      </CardContent>
    </Card>
  )
}
