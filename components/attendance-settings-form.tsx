"use client"

import { useState, useTransition, type FormEvent } from "react"
import { toast } from "sonner"

import {
  toggleAttendanceSyncEnabledAction,
  updateAttendanceSyncSettingsAction,
} from "@/server/actions/attendance"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"

type SyncMode = "INTERVAL" | "SCHEDULED"

export function AttendanceSettingsForm({
  enabled: initialEnabled,
  syncMode: initialSyncMode,
  pollSeconds,
  scheduledTimes,
}: {
  enabled: boolean
  syncMode: SyncMode
  pollSeconds: number
  scheduledTimes: string
}) {
  const [isPending, startTransition] = useTransition()
  const [isTogglePending, startToggleTransition] = useTransition()
  const [enabled, setEnabled] = useState(initialEnabled)
  const [syncMode, setSyncMode] = useState<SyncMode>(initialSyncMode)

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
    formData.set("syncMode", syncMode)
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
              ? "Sedang aktif — mengikuti mode & jadwal di bawah."
              : "Sedang mati — tombol \"Ambil Data Mesin\" manual tetap bisa dipakai."}
          </p>
        </div>
        <Switch checked={enabled} onCheckedChange={handleToggle} disabled={isTogglePending} />
      </div>

      <form onSubmit={handleSubmit} className={enabled ? "grid gap-4" : "grid gap-4 opacity-50"}>
        <fieldset disabled={!enabled} className="grid gap-4">
          <div className="grid gap-2">
            <Label>Mode Sinkronisasi</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={syncMode === "INTERVAL" ? "default" : "outline"}
                onClick={() => setSyncMode("INTERVAL")}
              >
                Interval Berkala
              </Button>
              <Button
                type="button"
                size="sm"
                variant={syncMode === "SCHEDULED" ? "default" : "outline"}
                onClick={() => setSyncMode("SCHEDULED")}
              >
                Jadwal Jam Tertentu
              </Button>
            </div>
          </div>

          {syncMode === "INTERVAL" ? (
            <div key="interval" className="grid gap-2">
              <Label htmlFor="pollSeconds">Interval Polling (detik)</Label>
              <Input
                id="pollSeconds"
                name="pollSeconds"
                type="number"
                min={5}
                defaultValue={pollSeconds}
                className="w-40"
              />
            </div>
          ) : (
            <div key="scheduled" className="grid gap-2">
              <Label htmlFor="scheduledTimes">Jadwal Jam (pisahkan dengan koma)</Label>
              <Input
                id="scheduledTimes"
                name="scheduledTimes"
                defaultValue={scheduledTimes}
                placeholder="mis. 08:00, 12:00, 17:00"
                className="max-w-sm"
              />
              <p className="text-xs text-muted-foreground">
                Format 24 jam HH:mm. Sinkronisasi cuma jalan persis di menit-menit ini, bukan
                terus-menerus sepanjang hari.
              </p>
            </div>
          )}

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
