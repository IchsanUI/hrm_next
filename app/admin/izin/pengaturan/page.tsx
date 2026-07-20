import { SlidersHorizontal } from "lucide-react"

import { ModuleBlueprintPage } from "@/components/module-blueprint-page"

export default function PengaturanIzinPage() {
  return (
    <ModuleBlueprintPage
      breadcrumbItems={[
        { label: "Dashboard", href: "/admin/dashboard" },
        { label: "Izin" },
        { label: "Pengaturan Izin" },
      ]}
      title="Pengaturan Izin"
      description="Kelola aturan umum modul izin/cuti — di luar urutan approver yang sudah diatur lewat Alur Approval."
      icon={SlidersHorizontal}
      plannedFeatures={[
        "Kuota cuti tahunan default & aturan pembulatan",
        "Ambang batas dokumen pendukung wajib per jenis izin",
        "Aktif/nonaktifkan jenis izin tertentu secara organisasi",
        "Sinkron dengan Hari Libur Nasional untuk perhitungan hari kerja",
      ]}
    />
  )
}
