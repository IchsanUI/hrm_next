import { Breadcrumb } from "@/components/breadcrumb"

export default function PerhitunganKpiPage() {
  return (
    <div>
      <Breadcrumb
        items={[
          { label: "Dashboard", href: "/admin/dashboard" },
          { label: "KPI" },
          { label: "Perhitungan KPI" },
        ]}
      />
      <h1 className="mb-1 text-2xl font-semibold">Perhitungan KPI</h1>
      <p className="text-sm text-muted-foreground">
        Modul ini sedang disiapkan. Fitur perhitungan KPI akan tersedia di sini.
      </p>
    </div>
  )
}
