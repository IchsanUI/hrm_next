import { ReceiptText } from "lucide-react"

import { ModuleBlueprintPage } from "@/components/module-blueprint-page"

export default function PegawaiSlipGajiPage() {
  return (
    <ModuleBlueprintPage
      breadcrumbItems={[
        { label: "Dashboard", href: "/pegawai/dashboard" },
        { label: "Slip Gaji" },
      ]}
      title="Slip Gaji"
      description="Riwayat slip gaji Anda yang sudah diproses, per periode."
      icon={ReceiptText}
      plannedFeatures={[
        "Riwayat slip gaji Anda per periode",
        "Rincian komponen (pendapatan vs potongan) per slip",
        "Unduh slip gaji format PDF",
      ]}
    />
  )
}
