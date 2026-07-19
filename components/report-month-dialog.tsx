"use client"

import { useState } from "react"
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

  function handleSubmit() {
    if (!report) return
    if (report.downloadPath) {
      window.location.href = `${report.downloadPath}?bulan=${month}`
    } else {
      toast.info(`"${report.label}" akan dikembangkan pada tahap selanjutnya.`)
    }
    onOpenChange(false)
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
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button onClick={handleSubmit}>
            {report?.downloadPath ? "Unduh" : "Lanjutkan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
