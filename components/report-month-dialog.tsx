"use client"

import { useEffect, useState, useTransition } from "react"
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
  // Penjelasan singkat format/isi tabel Excel yang akan diunduh (kolom apa
  // saja, satu baris mewakili apa) — supaya user tahu isinya SEBELUM unduh,
  // tanpa perlu buka file dulu buat sekadar cek formatnya cocok atau tidak.
  formatDescription?: string
  // Kalau true, modal ini nambah dropdown "Nama Pegawai (opsional)" —
  // dikirim sebagai ?pegawaiId= ke downloadPath buat filter cuma 1 pegawai.
  // Opsinya diambil dari /api/laporan/pegawai-terhubung (data kepegawaian
  // yang PIN-nya sudah dipetakan), BUKAN dari nilai nama mentah di log
  // mesin — supaya satu pegawai selalu satu opsi yang konsisten.
  withEmployeeFilter?: boolean
}

type EmployeeOption = { id: number; fullName: string }

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
  const [employeeId, setEmployeeId] = useState("")
  const [employeeOptions, setEmployeeOptions] = useState<EmployeeOption[]>([])
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (!report?.withEmployeeFilter) return
    setEmployeeId("")
    let cancelled = false
    fetch("/api/laporan/pegawai-terhubung")
      .then((res) => res.json())
      .then((data: { employees?: EmployeeOption[] }) => {
        if (!cancelled) setEmployeeOptions(data.employees ?? [])
      })
      .catch(() => {
        if (!cancelled) setEmployeeOptions([])
      })
    return () => {
      cancelled = true
    }
  }, [report])

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
    const query = new URLSearchParams({ bulan: month })
    if (employeeId) query.set("pegawaiId", employeeId)
    startTransition(async () => {
      try {
        const res = await fetch(`${downloadPath}?${query.toString()}`)
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

        {report?.formatDescription ? (
          <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            {report.formatDescription}
          </div>
        ) : null}

        <div className="grid gap-1.5">
          <Label htmlFor="report-month">Bulan</Label>
          <Input
            id="report-month"
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </div>

        {report?.withEmployeeFilter ? (
          <div className="grid gap-1.5">
            <Label htmlFor="report-employee">Nama Pegawai (opsional)</Label>
            <select
              id="report-employee"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              className="h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm dark:bg-input/30"
            >
              <option value="">Semua pegawai</option>
              {employeeOptions.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.fullName}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              Kosongkan untuk mengunduh data semua pegawai.
            </p>
          </div>
        ) : null}

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
