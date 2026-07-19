"use client"

import { useActionState, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Info } from "lucide-react"

import {
  createCutiRequestAction,
  type CutiFormState,
} from "@/server/actions/cuti"
import {
  cutiDurationDays,
  CUTI_DOCUMENT_REQUIRED_THRESHOLD_DAYS,
} from "@/lib/validations/cuti"
import { countWorkingDays } from "@/lib/working-days"
import type { HolidayInRange } from "@/lib/leave-balance"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

const SHORT_MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des",
]

// Format manual dari string "YYYY-MM-DD" — sengaja tidak lewat `new Date()` +
// toLocaleDateString supaya tidak kena geser timezone browser.
function formatIsoDateShort(iso: string) {
  const [, month, day] = iso.split("-")
  return `${day} ${SHORT_MONTHS[Number(month) - 1]}`
}

function todayDateInputValue() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function CutiRequestForm({
  colleagues,
  remainingBalance,
  balanceYear,
  holidays,
  blockedByCutiBesar,
}: {
  colleagues: { id: number; fullName: string; position: { name: string } }[]
  remainingBalance: number
  balanceYear: number
  holidays: HolidayInRange[]
  blockedByCutiBesar: boolean
}) {
  const [state, formAction, isPending] = useActionState<CutiFormState, FormData>(
    createCutiRequestAction,
    undefined
  )
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const excludedSet = useMemo(
    () => new Set(holidays.filter((h) => !h.isOfficeOpen).map((h) => h.date)),
    [holidays]
  )

  useEffect(() => {
    if (state?.error) toast.error(state.error)
  }, [state])

  const duration = useMemo(() => {
    if (!startDate || !endDate || endDate < startDate) return 0
    return cutiDurationDays(startDate, endDate)
  }, [startDate, endDate])
  const requiresDocument = duration > CUTI_DOCUMENT_REQUIRED_THRESHOLD_DAYS

  const workingDays = useMemo(() => {
    if (!startDate || !endDate || endDate < startDate) return 0
    return countWorkingDays(new Date(startDate), new Date(endDate), excludedSet)
  }, [startDate, endDate, excludedSet])
  const exceedsBalance = workingDays > remainingBalance

  // Hari libur nasional/cuti bersama yang bertepatan dengan rentang tanggal
  // yang dipilih — Sabtu/Minggu tidak perlu disebutkan di sini karena sudah
  // jelas dari kalender, cukup ditampilkan yang tidak terduga (hari libur).
  const holidaysInRange = useMemo(() => {
    if (!startDate || !endDate || endDate < startDate) return []
    return holidays.filter((h) => h.date >= startDate && h.date <= endDate)
  }, [startDate, endDate, holidays])

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle>Form Pengajuan Izin Cuti</CardTitle>
        <CardDescription>
          Isi tanggal dan alasan cuti Anda. Pengajuan lebih dari{" "}
          {CUTI_DOCUMENT_REQUIRED_THRESHOLD_DAYS} hari wajib melampirkan dokumen
          pendukung.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {blockedByCutiBesar ? (
          <div className="mb-4 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
            <Info className="mt-0.5 size-3.5 shrink-0 text-amber-500" />
            <p>
              Anda sedang menjalani Cuti Besar tahun {balanceYear} — sesuai
              Pasal 38 ayat 3, hak Cuti Tahunan Anda tahun ini otomatis
              tidak berlaku.
            </p>
          </div>
        ) : (
          <div className="mb-4 flex items-start gap-2 rounded-md border border-primary/20 bg-primary/5 p-2.5 text-xs text-foreground">
            <Info className="mt-0.5 size-3.5 shrink-0 text-primary" />
            <p>
              Sisa saldo cuti Anda tahun {balanceYear}:{" "}
              <span className="font-semibold">{remainingBalance} hari kerja</span>.
              Sabtu, Minggu, dan hari libur nasional tidak dihitung.
            </p>
          </div>
        )}

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
                min={startDate || todayDateInputValue()}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
              />
            </div>
          </div>

          {duration > 0 ? (
            <div className="grid gap-1 text-xs text-muted-foreground">
              <p>
                Durasi cuti: <span className="font-medium">{duration} hari kalender</span>
                {requiresDocument
                  ? " — dokumen pendukung wajib dilampirkan."
                  : " — dokumen pendukung tidak wajib."}
              </p>
              <p className={cn(exceedsBalance && "font-medium text-destructive")}>
                Memotong saldo cuti: <span className="font-medium">{workingDays} hari kerja</span>
                {exceedsBalance ? " — melebihi sisa saldo cuti Anda!" : ""}
              </p>
            </div>
          ) : null}

          {holidaysInRange.length > 0 ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
              <p className="font-medium">Bertepatan dengan hari libur:</p>
              <ul className="mt-1 grid gap-0.5">
                {holidaysInRange.map((h) => (
                  <li key={h.date}>
                    {formatIsoDateShort(h.date)} — {h.name}
                    {h.isOfficeOpen
                      ? " (kantor tetap masuk, tetap dihitung hari kerja)"
                      : " (tidak dihitung)"}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="grid gap-2">
            <Label htmlFor="reason">Alasan Cuti</Label>
            <Textarea
              id="reason"
              name="reason"
              placeholder="Jelaskan alasan pengajuan cuti Anda"
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

          {requiresDocument ? (
            <div className="grid gap-2">
              <Label htmlFor="supportingDocument">Dokumen Pendukung</Label>
              <Input
                id="supportingDocument"
                name="supportingDocument"
                type="file"
                accept="image/*,.pdf"
                required
              />
            </div>
          ) : null}

          {state?.error ? (
            <p className="text-destructive text-sm">{state.error}</p>
          ) : null}
          <div>
            <Button type="submit" disabled={isPending || (duration > 0 && exceedsBalance)}>
              {isPending ? "Mengirim..." : "Ajukan Izin Cuti"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
