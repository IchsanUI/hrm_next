import { Banknote } from "lucide-react"

import { ModuleBlueprintPage } from "@/components/module-blueprint-page"

export default function KomponenGajiPage() {
  return (
    <ModuleBlueprintPage
      breadcrumbItems={[
        { label: "Dashboard", href: "/admin/dashboard" },
        { label: "Payroll" },
        { label: "Komponen Gaji" },
      ]}
      title="Komponen Gaji"
      description="Master data komponen penyusun gaji — gaji pokok, tunjangan, dan potongan."
      icon={Banknote}
      plannedFeatures={[
        "Gaji pokok per jabatan/golongan",
        "Tunjangan tetap (jabatan, transport, makan, dll.)",
        "Tunjangan tidak tetap (lembur, kehadiran, dll.)",
        "Potongan (BPJS, pajak, kasbon, keterlambatan)",
        "Aturan perhitungan otomatis per komponen",
      ]}
    />
  )
}
