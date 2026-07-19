import { Rows3 } from "lucide-react"

import { ModuleBlueprintPage } from "@/components/module-blueprint-page"

export default function StrukturGajiPage() {
  return (
    <ModuleBlueprintPage
      breadcrumbItems={[
        { label: "Dashboard", href: "/admin/dashboard" },
        { label: "Payroll" },
        { label: "Struktur & Golongan Gaji" },
      ]}
      title="Struktur & Golongan Gaji"
      description="Tingkatan golongan/pangkat dan rentang gaji per jabatan."
      icon={Rows3}
      plannedFeatures={[
        "Golongan/pangkat & step kenaikan berkala",
        "Rentang gaji minimum-maksimum per golongan",
        "Pemetaan jabatan ke golongan gaji",
        "Riwayat kenaikan golongan pegawai",
      ]}
    />
  )
}
