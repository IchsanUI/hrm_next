import { prisma } from "@/lib/prisma"
import { Breadcrumb } from "@/components/breadcrumb"
import { BpjsCalculationGuide } from "@/components/bpjs-calculation-guide"
import { BpjsSettingsForm } from "@/components/bpjs-settings-form"
import { Pph21MethodForm } from "@/components/pph21-method-form"
import { Pph21MethodGuide } from "@/components/pph21-method-guide"
import { PtkpRatesForm, type PtkpRates } from "@/components/ptkp-rates-form"
import { TaxBracketTable } from "@/components/tax-bracket-table"
import { TerRateTable } from "@/components/ter-rate-table"
import { PTKP_STATUSES } from "@/lib/validations/payroll-tax"

export default async function PajakBpjsPage() {
  const [bpjsSettings, ptkpRateRows, taxBrackets, terRates] = await Promise.all([
    prisma.bpjsSettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } }),
    prisma.ptkpRate.findMany(),
    prisma.taxBracket.findMany({ orderBy: { order: "asc" } }),
    prisma.terRate.findMany({ orderBy: [{ category: "asc" }, { order: "asc" }] }),
  ])

  const ptkpRatesByStatus = new Map(ptkpRateRows.map((r) => [r.status, r.annualAmount]))
  const ptkpRates: PtkpRates = Object.fromEntries(
    PTKP_STATUSES.map((status) => [status, ptkpRatesByStatus.get(status) ?? 0])
  ) as PtkpRates

  return (
    <div>
      <Breadcrumb
        items={[
          { label: "Dashboard", href: "/admin/dashboard" },
          { label: "Payroll" },
          { label: "BPJS & Pajak (PPh 21)" },
        ]}
      />
      <h1 className="mb-1 text-2xl font-semibold">BPJS & Pajak (PPh 21)</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Pengaturan rate iuran BPJS Kesehatan/Ketenagakerjaan dan komponen
        perhitungan PPh 21 (PTKP + tarif progresif) — dipakai otomatis nanti
        saat Proses Payroll dijalankan.
      </p>

      <div className="grid gap-6">
        <Pph21MethodForm method={bpjsSettings.pph21Method} />
        <Pph21MethodGuide />
        <BpjsSettingsForm settings={bpjsSettings} />
        <BpjsCalculationGuide />
        <PtkpRatesForm rates={ptkpRates} />
        <TaxBracketTable brackets={taxBrackets} />
        <TerRateTable rates={terRates} />
      </div>
    </div>
  )
}
