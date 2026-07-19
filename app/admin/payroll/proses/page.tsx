import { Calculator } from "lucide-react"

import { ModuleBlueprintPage } from "@/components/module-blueprint-page"

export default function ProsesPayrollPage() {
  return (
    <ModuleBlueprintPage
      breadcrumbItems={[
        { label: "Dashboard", href: "/admin/dashboard" },
        { label: "Payroll" },
        { label: "Proses Payroll" },
      ]}
      title="Proses Payroll"
      description="Menjalankan perhitungan gaji bulanan untuk seluruh pegawai."
      icon={Calculator}
      plannedFeatures={[
        "Generate perhitungan gaji per periode (bulanan)",
        "Tarik otomatis data kehadiran, lembur, dan izin/cuti tak berbayar",
        "Preview & koreksi sebelum difinalisasi",
        "Alur approval sebelum payroll dikunci",
        "Ekspor hasil ke bank/rekening untuk transfer",
      ]}
    />
  )
}
