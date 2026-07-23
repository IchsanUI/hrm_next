"use client"

import { useRef, useState, useTransition, type FormEvent } from "react"
import { Download, Upload } from "lucide-react"
import { toast } from "sonner"

import {
  importSalaryGradeRatesAction,
  type ImportSalaryGradeRateState,
} from "@/server/actions/salary-scale"
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

export function SalaryGradeRateImportButton({ versionId }: { versionId: number }) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const formRef = useRef<HTMLFormElement>(null)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    startTransition(async () => {
      const result: ImportSalaryGradeRateState = await importSalaryGradeRatesAction(undefined, formData)
      if (!result) return
      if (!result.success) {
        setError(result.error)
        toast.error(result.error)
        return
      }
      setError(null)
      setOpen(false)
      formRef.current?.reset()
      toast.success(`${result.imported} baris rate berhasil diimpor.`)
      if (result.createdGrades.length > 0) {
        toast.info(`${result.createdGrades.length} golongan baru otomatis dibuat.`, {
          description: result.createdGrades.join(", "),
        })
      }
      if (result.errors.length > 0) {
        toast.warning(`${result.errors.length} baris dilewati.`, {
          description: result.errors.slice(0, 5).join(" "),
        })
      }
    })
  }

  return (
    <>
      <Button
        variant="outline"
        nativeButton={false}
        render={<a href="/api/master-data/skala-gaji/template" />}
      >
        <Download className="size-3.5" />
        Unduh Template
      </Button>
      <Button
        variant="outline"
        onClick={() => {
          setError(null)
          setOpen(true)
        }}
      >
        <Upload className="size-3.5" />
        Import Excel
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Tabel Gaji Pokok dari Excel</DialogTitle>
          </DialogHeader>
          <form ref={formRef} onSubmit={handleSubmit} className="grid gap-4">
            <p className="text-sm text-muted-foreground">
              Unduh template terlebih dahulu, isi Golongan/Ruang/MKG/Nominal,
              lalu unggah di sini. Golongan-Ruang yang belum terdaftar di
              Struktur & Golongan Gaji akan OTOMATIS dibuatkan. Baris dengan
              Golongan-Ruang-MKG yang sama akan menimpa nilai lama (aman
              untuk import ulang/revisi).
            </p>
            <input type="hidden" name="versionId" value={versionId} />
            <div className="grid gap-2">
              <Label htmlFor="import-rate-file">File Excel (.xlsx)</Label>
              <Input id="import-rate-file" name="file" type="file" accept=".xlsx" required />
            </div>
            {error ? <p className="text-destructive text-sm">{error}</p> : null}
            <DialogFooter>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Mengimpor..." : "Import"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
