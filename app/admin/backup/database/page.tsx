import Link from "next/link"
import type { BackupScope } from "@prisma/client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { BackupTriggerForm } from "@/components/backup-trigger-form"

const SCOPES: BackupScope[] = ["ALL", "KEPEGAWAIAN", "ABSENSI", "PAYROLL", "IZIN", "SISTEM"]

export default async function BackupSekarangPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string }>
}) {
  // ?scope=ABSENSI dst — dipakai tombol pintasan dari Monitoring Penyimpanan.
  const requestedScope = (await searchParams).scope
  const initialScope = SCOPES.find((s) => s === requestedScope) ?? "ALL"

  return (
    <Card>
      <CardHeader>
        <CardTitle>Backup Sekarang</CardTitle>
        <CardDescription>
          Pilih cakupan lalu picu backup — prosesnya berjalan di belakang layar, tidak memblokir
          aktivitas admin lain. Hasilnya bisa diunduh di tab{" "}
          <Link href="/admin/backup/database/riwayat" className="font-medium text-primary hover:underline">
            Riwayat
          </Link>
          .
        </CardDescription>
      </CardHeader>
      <CardContent>
        <BackupTriggerForm key={initialScope} initialScope={initialScope} />
      </CardContent>
    </Card>
  )
}
