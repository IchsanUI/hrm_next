import { HeartPulse } from "lucide-react"

import { ModuleBlueprintPage } from "@/components/module-blueprint-page"

export default function KlaimKesehatanPage() {
  return (
    <ModuleBlueprintPage
      breadcrumbItems={[
        { label: "Dashboard", href: "/admin/dashboard" },
        { label: "Payroll" },
        { label: "Klaim Kesehatan" },
      ]}
      title="Klaim Kesehatan"
      description="Pengajuan & persetujuan klaim/reimbursement biaya kesehatan pegawai — nantinya terhubung ke perhitungan Proses Payroll."
      icon={HeartPulse}
      plannedFeatures={[
        "Pengajuan klaim kesehatan pegawai (rawat jalan/inap, obat, dll.) beserta bukti pendukung",
        "Alur approval klaim (atasan langsung/HR), mengikuti pola alur approval izin yang sudah ada",
        "Plafon/batas klaim per pegawai atau per jenis klaim per tahun",
        "Klaim yang disetujui otomatis masuk sebagai komponen payroll (mis. Reimbursement Kesehatan) di periode berjalan",
        "Riwayat & rekap klaim per pegawai per periode",
      ]}
    />
  )
}
