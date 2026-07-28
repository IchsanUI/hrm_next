"use client"

import { useRef, useState, useTransition, type FormEvent } from "react"
import { Download, Upload } from "lucide-react"
import { toast } from "sonner"

import { importTerRatesAction, type ImportTerRateState } from "@/server/actions/payroll-tax"
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

export function TerRateImportButton() {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const formRef = useRef<HTMLFormElement>(null)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    startTransition(async () => {
      const result: ImportTerRateState = await importTerRatesAction(undefined, formData)
      if (!result) return
      if (!result.success) {
        setError(result.error)
        toast.error(result.error)
        return
      }
      setError(null)
      setOpen(false)
      formRef.current?.reset()
      toast.success(`${result.imported} baris tarif TER berhasil diimpor (Kategori ${result.categories.join(", ")}).`)
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
        size="sm"
        nativeButton={false}
        render={<a href="/api/master-data/tarif-ter/template" />}
      >
        <Download className="size-3.5" />
        Unduh Template
      </Button>
      <Button
        variant="outline"
        size="sm"
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
            <DialogTitle>Import Tarif TER dari Excel</DialogTitle>
          </DialogHeader>
          <form ref={formRef} onSubmit={handleSubmit} className="grid gap-4">
            <p className="text-sm text-muted-foreground">
              Unduh template terlebih dahulu, isi Kategori/lapisan
              bruto/tarif sesuai lampiran PMK 168/2023, lalu unggah di sini.
              Import ulang untuk kategori yang sama akan MENIMPA seluruh
              tarif kategori itu (aman untuk revisi), kategori lain tidak
              ikut berubah.
            </p>
            <div className="grid gap-2">
              <Label htmlFor="import-ter-file">File Excel (.xlsx)</Label>
              <Input id="import-ter-file" name="file" type="file" accept=".xlsx" required />
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
