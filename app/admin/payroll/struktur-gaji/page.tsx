import Link from "next/link"

import { prisma } from "@/lib/prisma"
import { Breadcrumb } from "@/components/breadcrumb"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { SalaryGradeTable, type SalaryGrade } from "@/components/salary-grade-table"

export default async function StrukturGajiPage() {
  const activeVersion = await prisma.salaryScaleVersion.findFirst({ where: { isActive: true } })

  // Cuma tampilkan golongan yang punya rate di versi PP yang sedang AKTIF —
  // ganti versi aktif otomatis ganti daftar golongan yang muncul di sini
  // (lihat diskusi di komit ini). Rentang Gaji dihitung ulang dari min/max
  // rate versi aktif itu, bukan dari field minSalary/maxSalary manual lagi.
  const grades = activeVersion
    ? await prisma.salaryGrade.findMany({
        where: { rates: { some: { versionId: activeVersion.id } } },
        include: { rates: { where: { versionId: activeVersion.id }, select: { amount: true } } },
        orderBy: [{ displayOrder: "asc" }, { code: "asc" }, { subGrade: "asc" }],
      })
    : []

  const rows: SalaryGrade[] = grades.map((g) => {
    const amounts = g.rates.map((r) => r.amount)
    return {
      id: g.id,
      code: g.code,
      subGrade: g.subGrade,
      minSalary: amounts.length > 0 ? Math.min(...amounts) : null,
      maxSalary: amounts.length > 0 ? Math.max(...amounts) : null,
      displayOrder: g.displayOrder,
      isActive: g.isActive,
    }
  })

  return (
    <div>
      <Breadcrumb
        items={[
          { label: "Dashboard", href: "/admin/dashboard" },
          { label: "Payroll" },
          { label: "Struktur & Golongan Gaji" },
        ]}
      />
      <h1 className="mb-1 text-2xl font-semibold">Struktur & Golongan Gaji</h1>
      <p className="mb-2 text-sm text-muted-foreground">
        Master data golongan-ruang (mis. &quot;C-1&quot;) beserta rentang gaji
        (dihitung otomatis dari versi PP yang sedang aktif). Golongan
        menempel langsung ke pegawai (bukan ke jabatan) — hanya golongan
        dengan data di versi PP AKTIF yang tampil di sini; kalau belum ada
        versi aktif, tabelnya kosong.
      </p>
      <p className="mb-6 flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">Acuan peraturan aktif:</span>
        {activeVersion ? (
          <Badge>{activeVersion.name}</Badge>
        ) : (
          <span className="text-muted-foreground">Belum ada versi aktif.</span>
        )}
      </p>
      <SalaryGradeTable
        grades={rows}
        extraAction={
          <Button
            variant="outline"
            render={<Link href="/admin/payroll/struktur-gaji/skala-pp" />}
            nativeButton={false}
          >
            Skala Gaji Pokok (PP)
          </Button>
        }
      />
    </div>
  )
}
