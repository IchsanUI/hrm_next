"use client"

import { useActionState, useEffect } from "react"
import { toast } from "sonner"

import {
  SESSION_IDLE_MAX_MINUTES,
  SESSION_IDLE_MIN_MINUTES,
  SESSION_WARNING_MAX_SECONDS,
  SESSION_WARNING_MIN_SECONDS,
} from "@/lib/session-idle"
import { updateSessionPolicyAction, type SessionPolicyState } from "@/server/actions/session-policy"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function SessionPolicyForm({ defaults }: { defaults: { idleMinutes: number; warningSeconds: number } }) {
  const [state, formAction, isPending] = useActionState<SessionPolicyState, FormData>(updateSessionPolicyAction, undefined)

  useEffect(() => {
    if (state?.error) toast.error(state.error)
    if (state?.success) toast.success("Pengaturan logout otomatis disimpan.")
  }, [state])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Logout Otomatis</CardTitle>
        <CardDescription>
          Pengguna otomatis keluar setelah tidak ada aktivitas (mouse, keyboard, sentuh, scroll) selama durasi ini, di semua
          tab yang terbuka. Setiap logout otomatis tercatat di Log Aktivitas.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="grid gap-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="idleMinutes">Logout setelah tidak aktif (menit)</Label>
              <Input
                id="idleMinutes"
                name="idleMinutes"
                type="number"
                min={SESSION_IDLE_MIN_MINUTES}
                max={SESSION_IDLE_MAX_MINUTES}
                defaultValue={defaults.idleMinutes}
                required
              />
              <p className="text-xs text-muted-foreground">
                {SESSION_IDLE_MIN_MINUTES}–{SESSION_IDLE_MAX_MINUTES} menit.
              </p>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="warningSeconds">Peringatan sebelum logout (detik)</Label>
              <Input
                id="warningSeconds"
                name="warningSeconds"
                type="number"
                min={SESSION_WARNING_MIN_SECONDS}
                max={SESSION_WARNING_MAX_SECONDS}
                defaultValue={defaults.warningSeconds}
                required
              />
              <p className="text-xs text-muted-foreground">
                Popup hitung mundur dengan tombol &quot;Tetap Masuk&quot;.
              </p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Berlaku untuk semua pengguna mulai aktivitas berikutnya; tidak ada yang dipaksa keluar saat pengaturan disimpan.
          </p>
          <div>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Menyimpan..." : "Simpan Pengaturan"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
