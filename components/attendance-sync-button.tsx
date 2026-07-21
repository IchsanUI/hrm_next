"use client"

import { useState, useTransition, type FormEvent } from "react"
import { toast } from "sonner"

import { syncAttendanceAction, type SyncAttendanceState } from "@/server/actions/attendance"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

function todayDateValue() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
}

export function AttendanceSyncButton() {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<SyncAttendanceState>(undefined)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    setResult(undefined)
    startTransition(async () => {
      const res = await syncAttendanceAction(undefined, formData)
      setResult(res)
      if (res?.error) {
        toast.error(res.error)
      } else if (res?.results) {
        const total = res.results.reduce((sum, r) => sum + r.saved, 0)
        toast.success(`${total} record baru tersimpan dari ${res.results.length} mesin.`)
      }
    })
  }

  return (
    <>
      <Button
        onClick={() => {
          setResult(undefined)
          setOpen(true)
        }}
      >
        Ambil Data Mesin
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ambil Data Mesin</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="grid gap-4">
            <p className="text-sm text-muted-foreground">
              Kosongkan rentang tanggal buat ambil data hari ini saja dari semua mesin aktif.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="sdate">Dari Tanggal</Label>
                <Input id="sdate" name="sdate" type="date" defaultValue={todayDateValue()} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edate">Sampai Tanggal</Label>
                <Input id="edate" name="edate" type="date" defaultValue={todayDateValue()} />
              </div>
            </div>

            {result?.error ? <p className="text-destructive text-sm">{result.error}</p> : null}
            {result?.results ? (
              <div className="grid max-h-[50vh] gap-3 overflow-y-auto rounded-lg border p-3 text-sm">
                {result.results.map((r) => (
                  <div key={r.deviceName}>
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-medium">{r.deviceName}</span>
                      {r.error ? (
                        <span className="text-right text-destructive">{r.error}</span>
                      ) : (
                        <span className="text-right text-muted-foreground">
                          {r.saved} record baru
                          <span className="block text-xs">
                            ({r.uidsFound} PIN diminta · {r.rawLineCount} baris mentah dari mesin)
                          </span>
                        </span>
                      )}
                    </div>
                    {r.trace.length > 0 ? (
                      <details className="mt-1">
                        <summary className="cursor-pointer text-xs text-primary">
                          Lihat detail pagination ({r.trace.length} langkah)
                        </summary>
                        <ul className="mt-1 grid gap-0.5 rounded bg-muted p-2 text-xs text-muted-foreground">
                          {r.trace.map((step, i) => (
                            <li key={i}>{step}</li>
                          ))}
                        </ul>
                      </details>
                    ) : null}
                    {r.sampleLines.length > 0 ? (
                      <details className="mt-1">
                        <summary className="cursor-pointer text-xs text-primary">
                          Lihat contoh baris mentah ({r.sampleLines.length})
                        </summary>
                        <ul className="mt-1 grid gap-0.5 rounded bg-muted p-2 font-mono text-xs break-all text-muted-foreground">
                          {r.sampleLines.map((line, i) => (
                            <li key={i}>{line}</li>
                          ))}
                        </ul>
                      </details>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}

            <DialogFooter>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Mengambil data..." : "Mulai Ambil Data"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
