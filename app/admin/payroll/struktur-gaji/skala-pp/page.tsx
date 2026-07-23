import { prisma } from "@/lib/prisma"
import { Breadcrumb } from "@/components/breadcrumb"
import { SalaryScaleVersionTable, type SalaryScaleVersion } from "@/components/salary-scale-version-table"

export default async function SkalaGajiPpPage() {
  const versions = await prisma.salaryScaleVersion.findMany({
    include: { _count: { select: { rates: true } } },
    orderBy: { effectiveDate: "desc" },
  })

  const rows: SalaryScaleVersion[] = versions.map((v) => ({
    id: v.id,
    name: v.name,
    effectiveDate: v.effectiveDate.toISOString(),
    isActive: v.isActive,
    rateCount: v._count.rates,
  }))

  return (
    <div>
      <Breadcrumb
        items={[
          { label: "Dashboard", href: "/admin/dashboard" },
          { label: "Payroll" },
          { label: "Struktur & Golongan Gaji", href: "/admin/payroll/struktur-gaji" },
          { label: "Skala Gaji Pokok (PP)" },
        ]}
      />
      <h1 className="mb-1 text-2xl font-semibold">Skala Gaji Pokok (PP)</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Tabel gaji pokok resmi (mis. Peraturan Pemerintah tentang Gaji Pegawai
        Negeri Sipil) per versi/revisi — nominal PASTI per kombinasi
        Golongan-Ruang dan MKG (masa kerja golongan). Cuma satu versi yang
        boleh &quot;Aktif&quot; dalam satu waktu; versi lain tetap tersimpan
        sebagai arsip histori.
      </p>
      <SalaryScaleVersionTable versions={rows} />
    </div>
  )
}
