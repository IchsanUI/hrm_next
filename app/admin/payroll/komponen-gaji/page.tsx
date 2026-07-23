import { prisma } from "@/lib/prisma"
import { Breadcrumb } from "@/components/breadcrumb"
import { SalaryComponentTable, type SalaryComponent } from "@/components/salary-component-table"

export default async function KomponenGajiPage() {
  const components = await prisma.salaryComponent.findMany({
    include: { baseComponent: { select: { name: true } } },
    orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
  })

  const rows: SalaryComponent[] = components.map((c) => ({
    id: c.id,
    name: c.name,
    category: c.category,
    calculationType: c.calculationType,
    percentageValue: c.percentageValue,
    baseComponentId: c.baseComponentId,
    baseComponentName: c.baseComponent?.name ?? null,
    includedInBruto: c.includedInBruto,
    isTaxable: c.isTaxable,
    isBaseSalary: c.isBaseSalary,
    displayOrder: c.displayOrder,
    isActive: c.isActive,
  }))

  return (
    <div>
      <Breadcrumb
        items={[
          { label: "Dashboard", href: "/admin/dashboard" },
          { label: "Payroll" },
          { label: "Komponen Gaji" },
        ]}
      />
      <h1 className="mb-1 text-2xl font-semibold">Komponen Gaji</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Master data komponen penyusun gaji — definisi Gaji Pokok, tunjangan,
        potongan, dan pinjaman. Nilai per pegawai diatur di tab &quot;Data
        Payroll&quot; pada halaman Detail Pegawai.
      </p>
      <SalaryComponentTable components={rows} />
    </div>
  )
}
