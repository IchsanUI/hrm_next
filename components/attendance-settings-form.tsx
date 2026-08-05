"use client"

import { useTransition, useState, type FormEvent } from "react"
import { toast } from "sonner"

import {
  toggleAttendanceSyncEnabledAction,
  updateAttendanceSyncSettingsAction,
} from "@/server/actions/attendance"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"

// Mode "Jadwal Jam Tertentu" SENGAJA disembunyikan sementara (bukan
// dihapus) — fokus dulu ke mode Interval Berkala, sama alasannya dengan
// lib/attendance/auto-sync-scheduler.ts. `syncMode` yang dikirim ke server
// SELALU "INTERVAL" untuk sekarang.

export function AttendanceSettingsForm({
  enabled: initialEnabled,
  pollSeconds,
}: {
  enabled: boolean
  pollSeconds: number
}) {
  const [isPending, startTransition] = useTransition()
  const [isTogglePending, startToggleTransition] = useTransition()
  const [enabled, setEnabled] = useState(initialEnabled)

  function handleToggle(next: boolean) {
    setEnabled(next) // optimis — dibalik lagi kalau server action gagal
    startToggleTransition(async () => {
      const result = await toggleAttendanceSyncEnabledAction(next)
      if (result?.error) {
        setEnabled(!next)
        toast.error(result.error)
      } else {
        toast.success(next ? "Auto-sync absensi dinyalakan." : "Auto-sync absensi dimatikan.")
      }
    })
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    formData.set("syncMode", "INTERVAL")
    startTransition(async () => {
      const result = await updateAttendanceSyncSettingsAction(undefined, formData)
      if (result?.error) {
        toast.error(result.error)
      } else {
        toast.success("Pengaturan sinkronisasi absensi disimpan.")
      }
    })
  }

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
        <div>
          <p className="text-sm font-medium">Auto-Sync Absensi</p>
          <p className="text-xs text-muted-foreground">
            {enabled
              ? "Sedang aktif — mengikuti interval polling di bawah."
              : "Sedang mati — tombol \"Ambil Data Mesin\" manual tetap bisa dipakai."}
          </p>
        </div>
        <Switch checked={enabled} onCheckedChange={handleToggle} disabled={isTogglePending} />
      </div>

      <form onSubmit={handleSubmit} className={enabled ? "grid gap-4" : "grid gap-4 opacity-50"}>
        <fieldset disabled={!enabled} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="pollSeconds">Interval Polling (detik)</Label>
            <Input
              id="pollSeconds"
              name="pollSeconds"
              type="number"
              min={5}
              defaultValue={pollSeconds}
              className="w-40"
            />
            <p className="text-xs text-muted-foreground">
              Minimal 5 detik. Server mengambil data absensi dari semua mesin aktif otomatis
              tiap interval ini.
            </p>
          </div>

          <div>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Menyimpan..." : "Simpan"}
            </Button>
          </div>
        </fieldset>
      </form>
    </div>
  )
}
