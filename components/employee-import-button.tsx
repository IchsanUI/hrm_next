"use client"

import { useRef, useState, useTransition, type FormEvent } from "react"
import { Download, Upload } from "lucide-react"
import { toast } from "sonner"

import { importEmployeesAction, type ImportEmployeeState } from "@/server/actions/employees"
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

type Credential = { employeeNumber: string; fullName: string; password: string }

// Password sementara cuma dikembalikan SEKALI oleh importEmployeesAction
// (yang tersimpan di database cuma hash-nya) — begitu dialog ini ditutup,
// tidak ada cara lain melihatnya lagi selain reset password manual per akun.
function downloadCredentialsCsv(credentials: Credential[]) {
  const header = "NIP,Nama,Username,Password Sementara"
  const rows = credentials.map(
    (c) => `${c.employeeNumber},"${c.fullName.replace(/"/g, '""')}",${c.employeeNumber},${c.password}`
  )
  const csv = [header, ...rows].join("\n")
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `Kredensial Import Pegawai ${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export function EmployeeImportButton() {
  const [importOpen, setImportOpen] = useState(false)
  const [isImporting, startImportTransition] = useTransition()
  const [importError, setImportError] = useState<string | null>(null)
  const importFormRef = useRef<HTMLFormElement>(null)
  const [credentials, setCredentials] = useState<Credential[] | null>(null)

  function handleImportSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    startImportTransition(async () => {
      const result: ImportEmployeeState = await importEmployeesAction(undefined, formData)
      if (!result) return
      if (!result.success) {
        setImportError(result.error)
        toast.error(result.error)
        return
      }
      setImportError(null)
      setImportOpen(false)
      importFormRef.current?.reset()
      const parts = [`${result.imported} pegawai berhasil diimpor.`]
      if (result.failed > 0) parts.push(`${result.failed} baris gagal disimpan.`)
      toast.success(parts.join(" "))
      if (result.errors.length > 0) {
        toast.warning(`${result.errors.length} baris dilewati/gagal.`, {
          description: result.errors.slice(0, 5).join(" "),
        })
      }
      if (result.credentials.length > 0) {
        setCredentials(result.credentials)
      }
    })
  }

  return (
    <>
      <Button
        variant="outline"
        nativeButton={false}
        render={<a href="/api/master-data/pegawai/template" />}
      >
        <Download className="size-3.5" />
        Unduh Template
      </Button>
      <Button
        variant="outline"
        onClick={() => {
          setImportError(null)
          setImportOpen(true)
        }}
      >
        <Upload className="size-3.5" />
        Import Excel
      </Button>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Data Pegawai dari Excel</DialogTitle>
          </DialogHeader>
          <form ref={importFormRef} onSubmit={handleImportSubmit} className="grid gap-4">
            <p className="text-sm text-muted-foreground">
              Unduh template terlebih dahulu, isi datanya (lihat sheet
              &quot;Referensi&quot; untuk nama Bagian/Jabatan/Lokasi
              Kerja/Status Kepegawaian/Shift yang sudah ada), lalu unggah
              file di sini. Setiap baris valid akan langsung dibuatkan akun
              login pegawai.
            </p>
            <div className="grid gap-2">
              <Label htmlFor="import-employee-file">File Excel (.xlsx)</Label>
              <Input id="import-employee-file" name="file" type="file" accept=".xlsx" required />
            </div>
            {importError ? (
              <p className="text-destructive text-sm">{importError}</p>
            ) : null}
            <DialogFooter>
              <Button type="submit" disabled={isImporting}>
                {isImporting ? "Mengimpor..." : "Import"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={credentials !== null} onOpenChange={(open) => !open && setCredentials(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Akun Login Pegawai Baru</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Password sementara ini hanya ditampilkan sekali di sini — unduh
            atau catat sekarang, lalu sampaikan ke masing-masing pegawai
            untuk login pertama kali.
          </p>
          <div className="max-h-80 overflow-y-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="p-2 font-medium">NIP</th>
                  <th className="p-2 font-medium">Nama</th>
                  <th className="p-2 font-medium">Password</th>
                </tr>
              </thead>
              <tbody>
                {credentials?.map((c) => (
                  <tr key={c.employeeNumber} className="border-t">
                    <td className="p-2">{c.employeeNumber}</td>
                    <td className="p-2">{c.fullName}</td>
                    <td className="p-2 font-mono">{c.password}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => credentials && downloadCredentialsCsv(credentials)}
            >
              Unduh CSV
            </Button>
            <Button onClick={() => setCredentials(null)}>Selesai</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
