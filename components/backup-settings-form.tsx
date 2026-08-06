"use client"

import { useActionState, useEffect } from "react"
import { toast } from "sonner"

import { updateBackupSettingsAction } from "@/server/actions/backup"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function BackupSettingsForm({
  mysqldumpPath,
  retentionDays,
}: {
  mysqldumpPath: string
  retentionDays: number
}) {
  const [state, formAction, isPending] = useActionState(updateBackupSettingsAction, undefined)

  useEffect(() => {
    if (state?.error) toast.error(state.error)
    else if (state?.success) toast.success("Pengaturan backup disimpan.")
  }, [state])

  return (
    <form
      key={`${mysqldumpPath}-${retentionDays}`}
      action={formAction}
      className="grid gap-4"
    >
      <div className="grid gap-2">
        <Label htmlFor="mysqldumpPath">Lokasi mysqldump.exe</Label>
        <Input
          id="mysqldumpPath"
          name="mysqldumpPath"
          defaultValue={mysqldumpPath}
          placeholder="C:\xampp\mysql\bin\mysqldump.exe"
        />
        <p className="text-xs text-muted-foreground">
          Path lengkap ke file mysqldump.exe di server ini. Contoh lokasi umum: XAMPP —{" "}
          <code>C:\xampp\mysql\bin\mysqldump.exe</code>, Laragon —{" "}
          <code>C:\laragon\bin\mysql\mysql-x.x.x\bin\mysqldump.exe</code>.
        </p>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="retentionDays">Retensi Backup (hari)</Label>
        <Input
          id="retentionDays"
          name="retentionDays"
          type="number"
          min={1}
          defaultValue={retentionDays}
          className="w-40"
        />
        <p className="text-xs text-muted-foreground">
          Backup yang sudah selesai lebih lama dari ini akan dihapus otomatis dari server.
        </p>
      </div>
      <div>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Menyimpan..." : "Simpan Pengaturan"}
        </Button>
      </div>
    </form>
  )
}
