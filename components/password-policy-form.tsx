"use client"

import { useActionState, useEffect, useState } from "react"
import { toast } from "sonner"

import { updatePasswordPolicyAction, type PasswordPolicyState } from "@/server/actions/password-policy"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"

export function PasswordPolicyForm({
  defaults,
}: {
  defaults: { enabled: boolean; intervalDays: number; warningDays: number; historyCount: number; effectiveDate: string }
}) {
  const [state, formAction, isPending] = useActionState<PasswordPolicyState, FormData>(updatePasswordPolicyAction, undefined)
  const [enabled, setEnabled] = useState(defaults.enabled)

  useEffect(() => {
    if (state?.error) toast.error(state.error)
    if (state?.success) toast.success("Kebijakan password disimpan.")
  }, [state])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pengaturan Kebijakan</CardTitle>
        <CardDescription>
          Nilai interval wajib mengikuti kebijakan internal Bank Gresik (PADK OJK 43/2025 tidak menetapkan angka). Perubahan
          berlaku ke depan dan tidak mengubah tanggal ganti password pengguna.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="grid gap-5">
          <input type="hidden" name="enabled" value={enabled ? "on" : "off"} />
          <div className="flex items-start justify-between gap-4 rounded-lg border p-3.5">
            <div>
              <p className="text-sm font-medium">Wajibkan ganti password berkala</p>
              <p className="text-xs text-muted-foreground">
                Kalau nonaktif, hanya password awal/reset yang wajib diganti; riwayat password tetap dicek.
              </p>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} aria-label="Wajibkan ganti password berkala" />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="intervalDays">Interval ganti password (hari)</Label>
              <Input
                id="intervalDays"
                name="intervalDays"
                type="number"
                min={30}
                max={365}
                defaultValue={defaults.intervalDays}
                disabled={!enabled}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="effectiveDate">Mulai berlaku</Label>
              <Input id="effectiveDate" name="effectiveDate" type="date" defaultValue={defaults.effectiveDate} disabled={!enabled} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="warningDays">Pengingat sebelum tenggat (hari)</Label>
              <Input id="warningDays" name="warningDays" type="number" min={1} max={60} defaultValue={defaults.warningDays} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="historyCount">Tolak N password terakhir</Label>
              <Input id="historyCount" name="historyCount" type="number" min={1} max={24} defaultValue={defaults.historyCount} />
            </div>
          </div>
          {/* Input disabled tidak ikut terkirim — kirim nilai bawaan agar validasi tetap lolos saat nonaktif. */}
          {!enabled ? (
            <>
              <input type="hidden" name="intervalDays" value={defaults.intervalDays} />
              <input type="hidden" name="effectiveDate" value={defaults.effectiveDate} />
            </>
          ) : null}
          <p className="text-xs text-muted-foreground">
            Akun lama mendapat interval penuh terhitung sejak tanggal mulai berlaku, jadi tidak ada yang langsung terkunci di
            hari aktivasi.
          </p>
          <div>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Menyimpan..." : "Simpan Kebijakan"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
