import { FileBadge } from "lucide-react"

import { ModuleBlueprintPage } from "@/components/module-blueprint-page"

export default function PajakBpjsPage() {
  return (
    <ModuleBlueprintPage
      breadcrumbItems={[
        { label: "Dashboard", href: "/admin/dashboard" },
        { label: "Payroll" },
        { label: "BPJS & Pajak (PPh 21)" },
      ]}
      title="BPJS & Pajak (PPh 21)"
      description="Pengaturan iuran BPJS Kesehatan/Ketenagakerjaan dan perhitungan PPh 21."
      icon={FileBadge}
      plannedFeatures={[
        "Persentase & batas iuran BPJS Kesehatan/Ketenagakerjaan",
        "Perhitungan PPh 21 otomatis (PTKP, tarif progresif)",
        "Data NPWP & status PTKP per pegawai",
        "Rekap laporan iuran/pajak per periode untuk pelaporan resmi",
      ]}
    />
  )
}
