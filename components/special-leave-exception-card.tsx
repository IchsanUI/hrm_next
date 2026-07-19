"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Info } from "lucide-react"

import { toggleSpecialLeaveExceptionAction } from "@/server/actions/employees"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

function ExceptionRow({
  employeeId,
  type,
  label,
  used,
  exceptionEnabled,
}: {
  employeeId: number
  type: "HAJI" | "UMROH"
  label: string
  used: boolean
  exceptionEnabled: boolean
}) {
  const [isPending, startTransition] = useTransition()
  const [enabled, setEnabled] = useState(exceptionEnabled)

  function handleToggle() {
    const next = !enabled
    startTransition(async () => {
      try {
        await toggleSpecialLeaveExceptionAction(employeeId, type, next)
        setEnabled(next)
        toast.success(
          next
            ? `Pengecualian ${label} diaktifkan — pegawai bisa mengajukan lagi 1x.`
            : `Pengecualian ${label} dinonaktifkan.`
        )
      } catch {
        toast.error("Gagal mengubah izin pengecualian.")
      }
    })
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">
          {used ? "Sudah pernah diambil (APPROVED)" : "Belum pernah diambil"}
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
  )
}

export function SpecialLeaveExceptionCard({
  employeeId,
  usedHaji,
  usedUmroh,
  exceptionHaji,
  exceptionUmroh,
}: {
  employeeId: number
  usedHaji: boolean
  usedUmroh: boolean
  exceptionHaji: boolean
  exceptionUmroh: boolean
}) {
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Cuti Khusus Haji/Umroh</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 pt-4">
        <p className="flex items-start gap-1.5 rounded-md border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
          <Info className="mt-0.5 size-3.5 shrink-0 text-amber-500" />
          Pasal 41: masing-masing jenis cuma boleh diambil 1x seumur bekerja.
          Kalau pegawai ini perlu mengajukan lagi (mis. kasus khusus), aktifkan
          pengecualian di bawah — otomatis nonaktif lagi setelah dipakai untuk
          satu pengajuan baru.
        </p>
        <ExceptionRow
          employeeId={employeeId}
          type="HAJI"
          label="Cuti Khusus Haji"
          used={usedHaji}
          exceptionEnabled={exceptionHaji}
        />
        <ExceptionRow
          employeeId={employeeId}
          type="UMROH"
          label="Cuti Khusus Umroh"
          used={usedUmroh}
          exceptionEnabled={exceptionUmroh}
        />
      </CardContent>
    </Card>
  )
}
