"use client"

import { useRef, useState, useTransition, type FormEvent } from "react"
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { importEmployeeHistoryAction } from "@/server/actions/employee-history-import"
import type { HistoryImportResult } from "@/lib/employee-history-import"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

// Import massal data riwayat (pekerjaan, pelatihan, prestasi, reward &
// punishment, mutasi, surat tugas) untuk semua pegawai sekaligus — tanpa
// file pendukung, yang tetap diunggah per pegawai dari halaman detail.
export function EmployeeHistoryImportButton() {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<HistoryImportResult | null>(null)
  const [isPending, startTransition] = useTransition()
  const formRef = useRef<HTMLFormElement>(null)

  function reset() {
    setError(null)
    setResult(null)
    formRef.current?.reset()
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    startTransition(async () => {
      const res = await importEmployeeHistoryAction(formData)
      if (!res) return
      if (res.error !== undefined) {
        setError(res.error)
        toast.error(res.error)
        return
      }
      setError(null)
      setResult(res)
      const inserted = res.summaries.reduce((s, x) => s + x.inserted, 0)
      toast.success(`${inserted} data riwayat berhasil diimpor.`)
    })
  }

  const totalInserted = result?.summaries.reduce((s, x) => s + x.inserted, 0) ?? 0
  const totalDuplicates = result?.summaries.reduce((s, x) => s + x.duplicates, 0) ?? 0

  return (
    <>
      <Button
        variant="outline"
        onClick={() => {
          reset()
          setOpen(true)
        }}
      >
        <FileSpreadsheet className="size-3.5" />
        Import Riwayat
      </Button>

      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (isPending) return
          setOpen(v)
          if (!v) reset()
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Import Data Riwayat Pegawai</DialogTitle>
            <DialogDescription>
              Satu file Excel untuk semua pegawai: riwayat pekerjaan, pendidikan &amp; pelatihan, prestasi,
              reward &amp; punishment, mutasi, dan surat tugas.
            </DialogDescription>
          </DialogHeader>

          {result ? (
            <div className="grid gap-4">
              <div className="flex items-start gap-3 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm">
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <div>
                  <p className="font-medium">{totalInserted} data riwayat ditambahkan</p>
                  {totalDuplicates > 0 ? (
                    <p className="text-xs text-muted-foreground">
                      {totalDuplicates} baris dilewati karena sudah ada (data sama persis).
                    </p>
                  ) : null}
                </div>
              </div>

              <table className="w-full overflow-hidden rounded-lg border text-sm">
                <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Jenis</th>
                    <th className="px-3 py-2 text-right font-medium">Ditambah</th>
                    <th className="px-3 py-2 text-right font-medium">Sudah ada</th>
                    <th className="px-3 py-2 text-right font-medium">Gagal</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {result.summaries.map((s) => (
                    <tr key={s.kind}>
                      <td className="px-3 py-2">{s.label}</td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums">{s.inserted}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{s.duplicates}</td>
                      <td className={`px-3 py-2 text-right tabular-nums ${s.invalid > 0 ? "font-semibold text-destructive" : "text-muted-foreground"}`}>
                        {s.invalid}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {result.totalErrors > 0 ? (
                <div className="grid gap-1.5">
                  <p className="flex items-center gap-1.5 text-sm font-medium text-destructive">
                    <AlertTriangle className="size-4" />
                    {result.totalErrors} baris tidak diimpor
                  </p>
                  <ul className="max-h-40 overflow-y-auto rounded-lg border bg-muted/40 p-2 text-xs">
                    {result.errors.map((e, i) => (
                      <li key={i} className="py-0.5">
                        {e}
                      </li>
                    ))}
                    {result.totalErrors > result.errors.length ? (
                      <li className="py-0.5 text-muted-foreground">
                        …dan {result.totalErrors - result.errors.length} lainnya
                      </li>
                    ) : null}
                  </ul>
                  <p className="text-xs text-muted-foreground">
                    Perbaiki baris di atas lalu impor ulang file yang sama — data yang sudah masuk tidak akan
                    dobel.
                  </p>
                </div>
              ) : null}

              <DialogFooter>
                <Button variant="outline" onClick={reset}>
                  Impor File Lain
                </Button>
                <Button onClick={() => setOpen(false)}>Selesai</Button>
              </DialogFooter>
            </div>
          ) : (
            <form ref={formRef} onSubmit={handleSubmit} className="grid gap-4">
              <ol className="grid gap-1.5 text-sm text-muted-foreground">
                <li>
                  1.{" "}
                  <a href="/api/master-data/pegawai/riwayat-template" className="font-medium text-primary hover:underline">
                    <Download className="mr-1 inline size-3.5" />
                    Unduh template
                  </a>{" "}
                  — berisi satu sheet per jenis riwayat dan daftar NIP pegawai.
                </li>
                <li>2. Isi sheet yang diperlukan saja, cocokkan pegawai lewat NIP.</li>
                <li>3. Unggah file di bawah.</li>
              </ol>
              <p className="rounded-md bg-muted/60 p-2.5 text-xs text-muted-foreground">
                File pendukung (sertifikat, SK, surat tugas) tidak ikut diimpor — unggah satu per satu dari
                Detail Pegawai → tab Riwayat.
              </p>
              <div className="grid gap-2">
                <Label htmlFor="import-history-file">File Excel (.xlsx)</Label>
                <Input id="import-history-file" name="file" type="file" accept=".xlsx" required disabled={isPending} />
              </div>
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
              <DialogFooter>
                <Button type="submit" disabled={isPending}>
                  {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
                  {isPending ? "Mengimpor..." : "Import"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
