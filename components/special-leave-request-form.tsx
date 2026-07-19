"use client"

import { useActionState, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

import {
  createSpecialLeaveRequestAction,
  type SpecialLeaveFormState,
} from "@/server/actions/special-leave"
import {
  SPECIAL_LEAVE_MAX_DAYS,
  SPECIAL_LEAVE_TYPE_LABEL,
  specialLeaveDurationDays,
} from "@/lib/validations/special-leave"
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

export function SpecialLeaveRequestForm({
  colleagues,
}: {
  colleagues: { id: number; fullName: string; position: { name: string } }[]
}) {
  const [state, formAction, isPending] = useActionState<SpecialLeaveFormState, FormData>(
    createSpecialLeaveRequestAction,
    undefined
  )
  const [type, setType] = useState<"HAJI" | "UMROH">("HAJI")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")

  useEffect(() => {
    if (state?.error) toast.error(state.error)
  }, [state])

  const duration = useMemo(() => {
    if (!startDate || !endDate || endDate < startDate) return 0
    return specialLeaveDurationDays(startDate, endDate)
  }, [startDate, endDate])
  const maxDays = SPECIAL_LEAVE_MAX_DAYS[type]
  const exceedsMax = duration > maxDays

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle>Form Pengajuan Cuti Khusus Haji/Umroh</CardTitle>
        <CardDescription>
          Sesuai Pasal 41 — Cuti Haji maks. {SPECIAL_LEAVE_MAX_DAYS.HAJI} hari,
          Cuti Umroh maks. {SPECIAL_LEAVE_MAX_DAYS.UMROH} hari, masing-masing
          hanya 1x seumur bekerja. Bukti pendaftaran/surat panggilan wajib
          dilampirkan saat pengajuan.
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
              onChange={(e) => setType(e.target.value as "HAJI" | "UMROH")}
              className="h-9 rounded-lg border border-input bg-transparent px-3 text-sm dark:bg-input/30"
            >
              <option value="HAJI">{SPECIAL_LEAVE_TYPE_LABEL.HAJI} (maks. {SPECIAL_LEAVE_MAX_DAYS.HAJI} hari)</option>
              <option value="UMROH">{SPECIAL_LEAVE_TYPE_LABEL.UMROH} (maks. {SPECIAL_LEAVE_MAX_DAYS.UMROH} hari)</option>
            </select>
          </div>

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
            <p className={cn("text-xs", exceedsMax ? "font-medium text-destructive" : "text-muted-foreground")}>
              Durasi: <span className="font-medium">{duration} hari</span> dari maks. {maxDays} hari
              {exceedsMax ? " — melebihi batas Pasal 41!" : ""}
            </p>
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
            <Label htmlFor="supportingDocument">Bukti Pendaftaran/Surat Panggilan</Label>
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
            <Button type="submit" disabled={isPending || (duration > 0 && exceedsMax)}>
              {isPending ? "Mengirim..." : "Ajukan Cuti"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
