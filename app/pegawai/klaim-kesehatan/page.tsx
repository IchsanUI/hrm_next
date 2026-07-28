import { HeartPulse } from "lucide-react"

import { ModuleBlueprintPage } from "@/components/module-blueprint-page"

export default function PegawaiKlaimKesehatanPage() {
  return (
    <ModuleBlueprintPage
      breadcrumbItems={[
        { label: "Dashboard", href: "/pegawai/dashboard" },
        { label: "Klaim Kesehatan" },
      ]}
      title="Klaim Kesehatan"
      description="Ajukan klaim/reimbursement biaya kesehatan Anda di sini."
      icon={HeartPulse}
      plannedFeatures={[
        "Ajukan klaim kesehatan (rawat jalan/inap, obat, dll.) beserta bukti pendukung (kuitansi/struk)",
        "Pantau status approval klaim (menunggu/disetujui/ditolak)",
        "Lihat sisa plafon klaim kesehatan Anda",
        "Klaim yang disetujui otomatis masuk ke slip gaji periode berjalan",
      ]}
    />
  )
}
