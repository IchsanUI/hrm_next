import { ReceiptText } from "lucide-react"

import { ModuleBlueprintPage } from "@/components/module-blueprint-page"

export default function SlipGajiPage() {
  return (
    <ModuleBlueprintPage
      breadcrumbItems={[
        { label: "Dashboard", href: "/admin/dashboard" },
        { label: "Payroll" },
        { label: "Slip Gaji Pegawai" },
      ]}
      title="Slip Gaji Pegawai"
      description="Riwayat slip gaji yang sudah diproses, per pegawai per periode."
      icon={ReceiptText}
      plannedFeatures={[
        "Riwayat slip gaji per pegawai per periode",
        "Rincian komponen (pendapatan vs potongan) per slip",
        "Unduh slip gaji format PDF",
        "Pegawai bisa melihat slip gajinya sendiri (self-service)",
      ]}
    />
  )
}
