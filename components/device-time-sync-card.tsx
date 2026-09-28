"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { AlarmClockCheck, CheckCircle2, XCircle } from "lucide-react"

import {
  syncAttendanceDeviceTimeAction,
  type SyncDeviceTimeState,
} from "@/server/actions/attendance"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

export function DeviceTimeSyncCard({ deviceCount }: { deviceCount: number }) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [result, setResult] = useState<SyncDeviceTimeState>(undefined)
  const [isPending, startTransition] = useTransition()

  function handleSync() {
    startTransition(async () => {
      const res = await syncAttendanceDeviceTimeAction()
      setResult(res)
      setConfirmOpen(false)
      if (!res) return
      const failed = res.results.filter((r) => !r.ok)
      if (failed.length === 0) {
        toast.success(`Jam ${res.results.length} mesin berhasil disamakan.`)
      } else if (failed.length === res.results.length) {
        toast.error("Gagal menyamakan jam mesin.")
      } else {
        toast.warning(`${failed.length} dari ${res.results.length} mesin gagal disamakan.`)
      }
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Samakan Jam Mesin</CardTitle>
        <CardDescription>
          Menyamakan jam seluruh mesin fingerprint yang aktif dengan jam server. Menggantikan
          cara manual membuka web mesin lalu menekan OK di menu Date/Time — biasanya diperlukan
          setiap habis mati listrik, karena jam mesin bisa meleset dari waktu sebenarnya.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="rounded-lg border border-dashed bg-muted/30 p-3 text-xs text-muted-foreground">
          Jam mesin yang meleset membuat seluruh data absensi ikut salah — jam masuk/pulang
          tercatat tidak sesuai, dan status Terlambat/Pulang Cepat jadi keliru. Sebaiknya
          dijalankan segera setelah listrik menyala kembali.
        </div>

        <div>
          <Button type="button" disabled={isPending || deviceCount === 0} onClick={() => setConfirmOpen(true)}>
            <AlarmClockCheck className="size-4" />
            {isPending ? "Menyamakan..." : "Samakan Jam Sekarang"}
          </Button>
          {deviceCount === 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Belum ada mesin absensi aktif yang bisa disamakan.
            </p>
          ) : null}
        </div>

        {result ? (
          <div className="grid gap-2 rounded-lg border p-3 text-sm">
            {result.serverTime ? (
              <p className="text-xs text-muted-foreground">
                Jam server yang dikirim: <span className="font-medium text-foreground">{result.serverTime}</span>
              </p>
            ) : null}
            {result.results.map((r, i) => (
              <div key={i} className="flex items-start gap-2">
                {r.ok ? (
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                ) : (
                  <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
                )}
                <p>
                  <span className="font-medium">{r.deviceName}</span> — {r.message}
                </p>
              </div>
            ))}
          </div>
        ) : null}
      </CardContent>

      {/* Konfirmasi dulu: ini menulis ke perangkat produksi, dan jam yang
          salah kirim berdampak ke seluruh pencatatan absensi. */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Samakan jam mesin dengan jam server?</AlertDialogTitle>
            <AlertDialogDescription>
              Jam pada {deviceCount} mesin absensi aktif akan ditimpa dengan jam server saat ini.
              Pastikan jam server sendiri sudah benar sebelum melanjutkan — kalau jam server
              meleset, mesin justru ikut meleset.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Batal</AlertDialogCancel>
            <AlertDialogAction disabled={isPending} onClick={handleSync}>
              {isPending ? "Menyamakan..." : "Ya, Samakan"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
