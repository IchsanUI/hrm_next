import { notFound } from "next/navigation"
import Link from "next/link"

import { prisma } from "@/lib/prisma"
import { Breadcrumb } from "@/components/breadcrumb"
import { Button } from "@/components/ui/button"
import { SalaryGradeRateImportButton } from "@/components/salary-grade-rate-import-button"

function formatRupiah(value: number) {
  return `Rp${value.toLocaleString("id-ID")}`
}

export default async function SkalaGajiPpDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const versionId = Number(id)

  const version = await prisma.salaryScaleVersion.findUnique({ where: { id: versionId } })
  if (!version) {
    notFound()
  }

  const [grades, rates] = await Promise.all([
    prisma.salaryGrade.findMany({
      orderBy: [{ displayOrder: "asc" }, { code: "asc" }, { subGrade: "asc" }],
    }),
    prisma.salaryGradeRate.findMany({ where: { versionId } }),
  ])

  const amountByKey = new Map(rates.map((r) => [`${r.salaryGradeId}-${r.step}`, r.amount]))
  const steps = Array.from(new Set(rates.map((r) => r.step))).sort((a, b) => a - b)
  const gradesWithData = grades.filter((g) => rates.some((r) => r.salaryGradeId === g.id))

  return (
    <div>
      <Breadcrumb
        items={[
          { label: "Dashboard", href: "/admin/dashboard" },
          { label: "Payroll" },
          { label: "Struktur & Golongan Gaji", href: "/admin/payroll/struktur-gaji" },
          { label: "Skala Gaji Pokok (PP)", href: "/admin/payroll/struktur-gaji/skala-pp" },
          { label: version.name },
        ]}
      />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{version.name}</h1>
          <p className="text-sm text-muted-foreground">
            Berlaku sejak{" "}
            {version.effectiveDate.toLocaleDateString("id-ID", {
              day: "2-digit",
              month: "long",
              year: "numeric",
            })}{" "}
            &middot; {version.isActive ? "Versi Aktif" : "Arsip"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            render={<Link href="/admin/payroll/struktur-gaji/skala-pp" />}
            nativeButton={false}
          >
            Kembali
          </Button>
          <SalaryGradeRateImportButton versionId={versionId} />
        </div>
      </div>

      {gradesWithData.length === 0 ? (
        <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          Belum ada data rate untuk versi ini. Unduh template lalu import
          Excel untuk mengisi tabel gaji pokok.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="sticky left-0 border-b border-r bg-muted/50 p-2 text-left font-medium">
                  MKG
                </th>
                {gradesWithData.map((g) => (
                  <th key={g.id} className="border-b p-2 text-center font-medium whitespace-nowrap">
                    {g.code}-{g.subGrade}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {steps.map((step) => (
                <tr key={step} className="border-b last:border-b-0">
                  <td className="sticky left-0 border-r bg-background p-2 font-medium">{step}</td>
                  {gradesWithData.map((g) => {
                    const amount = amountByKey.get(`${g.id}-${step}`)
                    return (
                      <td key={g.id} className="p-2 text-center whitespace-nowrap">
                        {amount !== undefined ? formatRupiah(amount) : "-"}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
