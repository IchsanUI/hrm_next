"use client"

import { useTransition, type FormEvent } from "react"
import { toast } from "sonner"

import { updatePtkpRatesAction } from "@/server/actions/payroll-tax"
import { PTKP_STATUSES, PTKP_STATUS_LABEL } from "@/lib/validations/payroll-tax"
import { RupiahInput } from "@/components/rupiah-input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export type PtkpRates = Record<(typeof PTKP_STATUSES)[number], number>

export function PtkpRatesForm({ rates }: { rates: PtkpRates }) {
  const [isPending, startTransition] = useTransition()

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    startTransition(async () => {
      const result = await updatePtkpRatesAction(undefined, formData)
      if (result?.error) {
        toast.error(result.error)
      } else {
        toast.success("Tabel PTKP berhasil disimpan.")
      }
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tabel PTKP (Penghasilan Tidak Kena Pajak)</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {PTKP_STATUSES.map((status) => (
              <div key={status} className="grid gap-2">
                <Label htmlFor={`ptkp-${status}`}>{PTKP_STATUS_LABEL[status]}</Label>
                <RupiahInput id={`ptkp-${status}`} name={status} defaultValue={rates[status]} />
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Nominal per tahun (Rupiah) — dibagi 12 otomatis saat dipakai di
            perhitungan bulanan.
          </p>
          <div>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Menyimpan..." : "Simpan"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
