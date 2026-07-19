"use client"

import { useActionState, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Lock } from "lucide-react"

import {
  createCutiBesarRequestAction,
  type CutiBesarFormState,
} from "@/server/actions/cuti-besar"
import {
  computeCutiBesarEndDate,
  isCutiBesarLate,
  CUTI_BESAR_MAX_INSTALLMENTS,
  type CutiBesarEligibility,
} from "@/lib/validations/cuti-besar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

function todayDateInputValue() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function CutiBesarRequestForm({
  colleagues,
  tenureYears,
  installmentsUsed,
  eligibility,
}: {
  colleagues: { id: number; fullName: string; position: { name: string } }[]
  tenureYears: number
  installmentsUsed: number
  eligibility: CutiBesarEligibility
}) {
  const [state, formAction, isPending] = useActionState<CutiBesarFormState, FormData>(
    createCutiBesarRequestAction,
    undefined
  )
  const [startDate, setStartDate] = useState("")

  useEffect(() => {
    if (state?.error) toast.error(state.error)
  }, [state])

  const endDate = useMemo(() => {
    if (!startDate) return ""
    return computeCutiBesarEndDate(startDate)
  }, [startDate])

  // Cuma penanda informasi buat pemohon/HR — tidak memblokir pengajuan.
  const nextInstallmentNumber = Math.min(installmentsUsed + 1, CUTI_BESAR_MAX_INSTALLMENTS) as 1 | 2
  const isLate =
    installmentsUsed < CUTI_BESAR_MAX_INSTALLMENTS &&
    isCutiBesarLate(nextInstallmentNumber, tenureYears)

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>Form Pengajuan Cuti Besar</CardTitle>
        <CardDescription>
          Sesuai Pasal 38 — total 2 bulan seumur bekerja, diambil sebagai 2
          pengajuan terpisah 1 bulan (tahun ke-7 & ke-8 masa kerja). Cuti
          Tahunan Anda di tahun yang sama otomatis tidak berlaku.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4 grid gap-1 rounded-md border border-primary/20 bg-primary/5 p-2.5 text-xs">
          <p>
            Masa kerja Anda saat ini: <span className="font-semibold">{tenureYears} tahun</span>
          </p>
          <p>
            Cuti Besar terpakai:{" "}
            <span className="font-semibold">{installmentsUsed} dari 2</span>
          </p>
          {isLate && eligibility.eligible ? (
            <div className="mt-1">
              <Badge variant="secondary" className="border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
                Terlambat dari jendela normal tahun ke-{nextInstallmentNumber === 1 ? 7 : 8}
              </Badge>
            </div>
          ) : null}
        </div>

        {!eligibility.eligible ? (
          <div className="flex items-start gap-2.5 rounded-md border border-dashed border-muted-foreground/30 bg-muted/40 p-4 text-sm">
            <Lock className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div>
              <p className="font-medium">Belum bisa mengajukan Cuti Besar</p>
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
                  min={todayDateInputValue()}
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="endDate">Tanggal Selesai</Label>
                <Input
                  id="endDate"
                  name="endDate"
                  type="date"
                  value={endDate}
                  readOnly
                  className="bg-muted"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Durasi tetap 1 bulan sesuai Pasal 38 — tanggal selesai otomatis
              mengikuti tanggal mulai.
            </p>

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
                {isPending ? "Mengirim..." : "Ajukan Cuti Besar"}
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  )
}
