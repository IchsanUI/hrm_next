import { Settings2 } from "lucide-react"

import { ModuleBlueprintPage } from "@/components/module-blueprint-page"

export default function PengaturanPayrollPage() {
  return (
    <ModuleBlueprintPage
      breadcrumbItems={[
        { label: "Dashboard", href: "/admin/dashboard" },
        { label: "Payroll" },
        { label: "Pengaturan Payroll" },
      ]}
      title="Pengaturan Payroll"
      description="Pengaturan umum modul payroll — periode, rekening, dan alur approval."
      icon={Settings2}
      plannedFeatures={[
        "Periode payroll (tanggal cut-off & tanggal bayar)",
        "Rekening bank perusahaan untuk transfer gaji",
        "Alur approval payroll (siapa yang mengunci/menyetujui)",
        "Hak akses modul payroll per role",
      ]}
    />
  )
}
