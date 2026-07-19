"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Info } from "lucide-react"

import { toggleCutiBesarExceptionAction } from "@/server/actions/employees"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

export function CutiBesarExceptionCard({
  employeeId,
  installmentsUsed,
  exceptionEnabled,
}: {
  employeeId: number
  installmentsUsed: number
  exceptionEnabled: boolean
}) {
  const [isPending, startTransition] = useTransition()
  const [enabled, setEnabled] = useState(exceptionEnabled)

  function handleToggle() {
    const next = !enabled
    startTransition(async () => {
      try {
        await toggleCutiBesarExceptionAction(employeeId, next)
        setEnabled(next)
        toast.success(
          next
            ? "Pengecualian Cuti Besar diaktifkan — pegawai bisa mengajukan lagi 1x."
            : "Pengecualian Cuti Besar dinonaktifkan."
        )
      } catch {
        toast.error("Gagal mengubah izin pengecualian.")
      }
    })
  }

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Cuti Besar</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 pt-4">
        <p className="flex items-start gap-1.5 rounded-md border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
          <Info className="mt-0.5 size-3.5 shrink-0 text-amber-500" />
          Pasal 38: maksimal 2x seumur bekerja (1 bulan tiap kali, tahun ke-7
          & ke-8 masa kerja). Kalau pegawai ini perlu mengajukan lagi (mis.
          kasus khusus), aktifkan pengecualian di bawah — otomatis nonaktif
          lagi setelah dipakai untuk satu pengajuan baru.
        </p>
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3">
          <div>
            <p className="text-sm font-medium">Cuti Besar</p>
            <p className="text-xs text-muted-foreground">
              Terpakai {installmentsUsed} dari 2
            </p>
          </div>
          <div className="flex items-center gap-2">
            {enabled ? <Badge>Pengecualian Aktif</Badge> : null}
            <Button
              variant={enabled ? "default" : "outline"}
              size="sm"
              disabled={isPending}
              onClick={handleToggle}
            >
              {enabled ? "Nonaktifkan" : "Buka Pengecualian"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
