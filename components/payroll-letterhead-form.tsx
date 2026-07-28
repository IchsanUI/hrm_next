"use client"

import { useTransition } from "react"
import { toast } from "sonner"

import {
  uploadPayrollLetterheadAction,
  removePayrollLetterheadAction,
} from "@/server/actions/payroll-settings"
import { EmployeeImageUpload } from "@/components/employee-image-upload"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

export function PayrollLetterheadForm({ letterheadUrl }: { letterheadUrl: string | null }) {
  const [isRemoving, startRemoveTransition] = useTransition()

  function handleRemove() {
    startRemoveTransition(async () => {
      const result = await removePayrollLetterheadAction()
      if (result?.error) {
        toast.error(result.error)
      } else {
        toast.success("Kop surat berhasil dihapus.")
      }
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Kop Surat Perusahaan</CardTitle>
        <CardDescription>
          Upload banner kop surat (logo + nama + alamat perusahaan sesuai desain resmi) — akan
          ditampilkan di bagian atas PDF Slip Gaji. Kosongkan kalau belum ada, PDF tetap tampil
          normal tanpa kop surat.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-start gap-3">
        <div className="w-full max-w-md rounded-lg border border-dashed bg-muted/30 p-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Format yang diterima</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            <li>File: JPG, PNG, atau WEBP — maksimal 4MB (otomatis dikonversi ke PNG saat disimpan).</li>
            <li>
              Bentuk: gambar landscape memanjang (mis. rasio sekitar 4:1, contoh 1200×300px) — cocok
              untuk banner logo + nama + alamat perusahaan berjajar, karena ditampilkan penuh tanpa
              dipotong di bagian atas PDF.
            </li>
            <li>Disarankan pakai PNG dengan latar transparan supaya menyatu rapi dengan dokumen.</li>
            <li>Gambar terlalu tinggi/persegi akan tetap muat, tapi tampil kecil (menyesuaikan lebar banner).</li>
          </ul>
        </div>
        <EmployeeImageUpload
          label="Kop Surat"
          fieldName="letterhead"
          action={uploadPayrollLetterheadAction}
          currentUrl={letterheadUrl}
          width={280}
          height={70}
          imageClassName="h-[70px] w-[280px] rounded-md border object-contain bg-white"
          emptyLabel="Belum ada kop surat"
        />
        {letterheadUrl ? (
          <Button type="button" variant="outline" size="sm" disabled={isRemoving} onClick={handleRemove}>
            {isRemoving ? "Menghapus..." : "Hapus Kop Surat"}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  )
}
