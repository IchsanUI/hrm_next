"use client"

import { useTransition, type FormEvent } from "react"
import { toast } from "sonner"

import { updatePayrollSettingsAction } from "@/server/actions/payroll-settings"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

export type PayrollSettings = {
  cutoffDay: number
  paymentDay: number
  bankName: string | null
  bankAccountNumber: string | null
  bankAccountHolder: string | null
  watermarkText: string | null
}

export function PayrollSettingsForm({ settings }: { settings: PayrollSettings }) {
  const [isPending, startTransition] = useTransition()

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    startTransition(async () => {
      const result = await updatePayrollSettingsAction(undefined, formData)
      if (result?.error) {
        toast.error(result.error)
      } else {
        toast.success("Pengaturan Payroll berhasil disimpan.")
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Periode Payroll</CardTitle>
          <CardDescription>
            Cut-off dipakai saat membuat periode BARU di Proses Payroll — mengubahnya tidak
            memengaruhi periode yang sudah pernah dibuat.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="cutoffDay">Tanggal Cut-off (mulai periode)</Label>
            <Input
              id="cutoffDay"
              name="cutoffDay"
              type="number"
              min={1}
              max={28}
              defaultValue={settings.cutoffDay}
              required
            />
            <p className="text-xs text-muted-foreground">
              Mis. 21 → periode berjalan tanggal 21 bulan sebelumnya s/d tanggal {settings.cutoffDay - 1} bulan berjalan.
            </p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="paymentDay">Tanggal Pembayaran Gaji</Label>
            <Input
              id="paymentDay"
              name="paymentDay"
              type="number"
              min={1}
              max={28}
              defaultValue={settings.paymentDay}
              required
            />
            <p className="text-xs text-muted-foreground">Informasi saja — belum memengaruhi kalkulasi apa pun.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Rekening Bank Perusahaan</CardTitle>
          <CardDescription>Ditampilkan sebagai referensi transfer gaji — opsional.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div className="grid gap-2">
            <Label htmlFor="bankName">Nama Bank</Label>
            <Input id="bankName" name="bankName" defaultValue={settings.bankName ?? ""} placeholder="mis. BCA" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="bankAccountNumber">No. Rekening</Label>
            <Input
              id="bankAccountNumber"
              name="bankAccountNumber"
              defaultValue={settings.bankAccountNumber ?? ""}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="bankAccountHolder">Atas Nama</Label>
            <Input
              id="bankAccountHolder"
              name="bankAccountHolder"
              defaultValue={settings.bankAccountHolder ?? ""}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Watermark Slip Gaji</CardTitle>
          <CardDescription>
            Teks ini diulang memenuhi seluruh halaman PDF Slip Gaji secara diagonal & transparan
            (mis. &quot;RAHASIA&quot; atau &quot;COPY&quot;). Kosongkan untuk mematikan watermark.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid max-w-sm gap-2">
            <Label htmlFor="watermarkText">Teks Watermark</Label>
            <Input
              id="watermarkText"
              name="watermarkText"
              defaultValue={settings.watermarkText ?? ""}
              placeholder="mis. RAHASIA"
              maxLength={40}
            />
          </div>
        </CardContent>
      </Card>

      <div>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Menyimpan..." : "Simpan"}
        </Button>
      </div>
    </form>
  )
}
