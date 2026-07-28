import { redirect } from "next/navigation"
import Link from "next/link"
import { ShieldCheck, Workflow } from "lucide-react"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { Breadcrumb } from "@/components/breadcrumb"
import { PayrollSettingsForm } from "@/components/payroll-settings-form"
import { PayrollLetterheadForm } from "@/components/payroll-letterhead-form"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

export default async function PengaturanPayrollPage() {
  const session = await auth()
  if (session?.user.role !== "SUPER_ADMIN") {
    redirect("/admin/dashboard")
  }

  const settings = await prisma.payrollSettings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  })

  return (
    <div>
      <Breadcrumb
        items={[
          { label: "Dashboard", href: "/admin/dashboard" },
          { label: "Payroll" },
          { label: "Pengaturan Payroll" },
        ]}
      />
      <h1 className="mb-1 text-2xl font-semibold">Pengaturan Payroll</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Pengaturan umum modul Payroll — periode cut-off, tanggal pembayaran, dan rekening bank
        perusahaan.
      </p>

      <div className="grid gap-6">
        <PayrollLetterheadForm letterheadUrl={settings.letterheadUrl} />
        <PayrollSettingsForm key={settings.updatedAt.getTime()} settings={settings} />

        <Card className="bg-muted/30">
          <CardHeader>
            <CardTitle className="text-base">Alur Approval &amp; Hak Akses Payroll</CardTitle>
            <CardDescription>
              Dua hal ini sudah diatur lewat menu lain, jadi tidak diduplikasi di sini.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <div className="flex items-start gap-3">
              <Workflow className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <p>
                <span className="font-medium">Alur approval:</span> proses payroll saat ini
                langsung dikunci/dibuka oleh admin (Draft ↔ Dikunci) di halaman{" "}
                <Link href="/admin/payroll/proses" className="text-primary hover:underline">
                  Proses Payroll
                </Link>
                , belum ada tahap approval berjenjang seperti pengajuan izin.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <p>
                <span className="font-medium">Hak akses per role:</span> siapa saja (akun HR
                Admin) yang boleh membuka tiap sub-menu Payroll diatur di{" "}
                <Link href="/admin/akses-hr" className="text-primary hover:underline">
                  Manajemen Akses HR
                </Link>
                .
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
