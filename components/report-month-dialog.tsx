"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export type SuratReportOption = {
  key: string
  label: string
  // Kalau ada, submit modal langsung download dari route ini (?bulan=yyyy-MM).
  // Kalau tidak ada, ini masih blueprint — submit cuma nampilin toast stub.
  downloadPath?: string
}

function currentMonthValue() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
}

export function ReportMonthDialog({
  report,
  onOpenChange,
}: {
  report: SuratReportOption | null
  onOpenChange: (open: boolean) => void
}) {
  const [month, setMonth] = useState(currentMonthValue)
  const [isPending, startTransition] = useTransition()

  function handleSubmit() {
    if (!report) return
    if (!report.downloadPath) {
      toast.info(`"${report.label}" akan dikembangkan pada tahap selanjutnya.`)
      onOpenChange(false)
      return
    }

    // Fetch dulu (bukan langsung window.location.href) supaya kalau server
    // balikin JSON error (mis. belum ada data buat periode itu), kita bisa
    // tampilkan toast alih-alih pindah halaman menampilkan JSON mentah.
    const downloadPath = report.downloadPath
    const label = report.label
    startTransition(async () => {
      try {
        const res = await fetch(`${downloadPath}?bulan=${month}`)
        const contentType = res.headers.get("content-type") ?? ""

        if (!res.ok || contentType.includes("application/json")) {
          const body = await res.json().catch(() => null)
          toast.error(body?.error ?? `Gagal mengunduh "${label}".`)
          return
        }

        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        const disposition = res.headers.get("content-disposition") ?? ""
        const match = disposition.match(/filename="([^"]+)"/)
        a.download = match?.[1] ?? `${label}.xlsx`
        document.body.appendChild(a)
        a.click()
        a.remove()
        URL.revokeObjectURL(url)
        onOpenChange(false)
      } catch {
        toast.error(`Gagal mengunduh "${label}".`)
      }
    })
  }

  return (
    <Dialog open={report !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{report?.label ?? "Pilih Bulan"}</DialogTitle>
          <DialogDescription>
            Pilih periode bulan untuk laporan ini.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-1.5">
          <Label htmlFor="report-month">Bulan</Label>
          <Input
            id="report-month"
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Batal
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? "Mengunduh..." : report?.downloadPath ? "Unduh" : "Lanjutkan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
