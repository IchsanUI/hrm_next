"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"

import { setOvertimeAutoRejectEnabledAction } from "@/server/actions/izin-settings"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"

export function OvertimeAutoRejectToggle({
  enabled: initialEnabled,
  canManage,
}: {
  enabled: boolean
  // false untuk HR_ADMIN yang bisa buka halaman Pengaturan Izin (akses
  // "approval.pengaturan") tapi TIDAK boleh ubah toggle ini — cuma
  // SUPER_ADMIN (lihat setOvertimeAutoRejectEnabledAction). Switch tetap
  // ditampilkan (transparan statusnya), cuma disabled.
  canManage: boolean
}) {
  const [enabled, setEnabled] = useState(initialEnabled)
  const [isPending, startTransition] = useTransition()

  function handleToggle(next: boolean) {
    setEnabled(next) // optimis — dibalik lagi kalau server action gagal
    startTransition(async () => {
      const result = await setOvertimeAutoRejectEnabledAction(next)
      if (result?.error) {
        setEnabled(!next)
        toast.error(result.error)
      } else {
        toast.success(
          next
            ? "Auto-reject Izin Lembur 24 jam diaktifkan."
            : "Auto-reject Izin Lembur 24 jam dinonaktifkan."
        )
      }
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Auto-Reject Izin Lembur 24 Jam</CardTitle>
        <CardDescription>
          Kalau aktif, pengajuan Izin Lembur yang belum diproses Atasan Langsung dalam 24 jam
          sejak diajukan otomatis ditolak sistem (lewat cron eksternal yang memanggil{" "}
          <code className="text-foreground">/api/cron/reject-expired-overtime</code>). Cuma step
          approval PERTAMA yang punya batas waktu ini — begitu Atasan Langsung sudah memproses,
          pengajuan aman apa pun lamanya step berikutnya. Hanya Super Admin yang bisa mengubah
          ini karena efeknya ke seluruh organisasi.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
          <div>
            <p className="text-sm font-medium">Auto-Reject Izin Lembur</p>
            <p className="text-xs text-muted-foreground">
              {enabled
                ? "Sedang aktif — cron tetap perlu dijadwalkan terpisah di server (lihat dokumentasi deployment)."
                : "Sedang mati — pengajuan lembur yang didiamkan Atasan Langsung akan menggantung Menunggu Approval sampai diproses manual."}
            </p>
          </div>
          <Switch
            checked={enabled}
            onCheckedChange={handleToggle}
            disabled={isPending || !canManage}
          />
        </div>
      </CardContent>
    </Card>
  )
}
