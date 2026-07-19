"use client"

import { useActionState, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

import {
  createDispensationRequestAction,
  type DispensationFormState,
} from "@/server/actions/dispensation"
import {
  DISPENSATION_CATEGORIES,
  DISPENSATION_CATEGORY_LABEL,
  DISPENSATION_CATEGORY_FIXED_DAYS,
  computeDispensationEndDate,
  resolveDispensationStartDate,
  type DispensationCategory,
} from "@/lib/validations/dispensation"
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

export function DispensationRequestForm({
  colleagues,
  excludedDates,
}: {
  colleagues: { id: number; fullName: string; position: { name: string } }[]
  excludedDates: string[]
}) {
  const [state, formAction, isPending] = useActionState<DispensationFormState, FormData>(
    createDispensationRequestAction,
    undefined
  )
  const excludedSet = useMemo(() => new Set(excludedDates), [excludedDates])
  const [category, setCategory] = useState<DispensationCategory>("PERNIKAHAN_SENDIRI")
  const [startDate, setStartDate] = useState(() =>
    resolveDispensationStartDate(todayDateInputValue(), excludedSet)
  )
  const [endDate, setEndDate] = useState("")

  useEffect(() => {
    if (state?.error) toast.error(state.error)
  }, [state])

  const fixedDays = DISPENSATION_CATEGORY_FIXED_DAYS[category]
  const isFixedDuration = fixedDays !== null

  const computedEndDate = useMemo(() => {
    if (!startDate || !isFixedDuration) return ""
    return computeDispensationEndDate(category, startDate, excludedSet) ?? ""
  }, [category, startDate, isFixedDuration, excludedSet])

  // Kategori tetap: endDate mengikuti hitungan otomatis. Kategori "wajar":
  // endDate manual, direset tiap ganti kategori/tanggal mulai biar tidak
  // ketinggalan rentang dari kategori sebelumnya.
  const effectiveEndDate = isFixedDuration ? computedEndDate : endDate

  function handleStartDateChange(value: string) {
    if (!value) {
      setStartDate(value)
      return
    }
    const resolved = resolveDispensationStartDate(value, excludedSet)
    if (resolved !== value) {
      toast.info(
        "Tanggal mulai digeser ke hari kerja berikutnya karena Sabtu/Minggu/hari libur nasional."
      )
    }
    setStartDate(resolved)
    if (!isFixedDuration) setEndDate("")
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>Form Pengajuan Dispensasi</CardTitle>
        <CardDescription>
          Sesuai Pasal 44 — gaji penuh, tidak memotong saldo Cuti Tahunan.
          Sebagian kategori punya durasi tetap, sebagian lagi berdasarkan
          perhitungan waktu yang wajar (dinilai approver). Sabtu, Minggu, dan
          hari libur nasional tidak dihitung dan tidak bisa jadi tanggal mulai.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="category">Kategori Dispensasi</Label>
            <select
              id="category"
              name="category"
              value={category}
              onChange={(e) => {
                setCategory(e.target.value as DispensationCategory)
                setEndDate("")
              }}
              className="h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm dark:bg-input/30"
            >
              {DISPENSATION_CATEGORIES.map((value) => {
                const days = DISPENSATION_CATEGORY_FIXED_DAYS[value]
                return (
                  <option key={value} value={value}>
                    {DISPENSATION_CATEGORY_LABEL[value]} ({days === null ? "waktu wajar" : `${days} hari`})
                  </option>
                )
              })}
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
                onChange={(e) => handleStartDateChange(e.target.value)}
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
                value={effectiveEndDate}
                onChange={(e) => setEndDate(e.target.value)}
                readOnly={isFixedDuration}
                className={isFixedDuration ? "bg-muted" : undefined}
                required
              />
            </div>
          </div>

          {isFixedDuration ? (
            <p className="text-xs text-muted-foreground">
              Durasi tetap {fixedDays} hari kerja sesuai Pasal 44 — tanggal
              selesai otomatis mengikuti tanggal mulai, melompati Sabtu/Minggu/
              hari libur nasional.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Kategori ini berdasarkan perhitungan waktu yang wajar — pilih
              rentang tanggal sesuai kebutuhan, approver akan menilai
              kewajarannya.
            </p>
          )}

          <div className="grid gap-2">
            <Label htmlFor="reason">Keterangan</Label>
            <Textarea
              id="reason"
              name="reason"
              placeholder="Jelaskan detail kejadian (mis. nama yang bersangkutan, lokasi, dsb.)"
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
              {isPending ? "Mengirim..." : "Ajukan Dispensasi"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
