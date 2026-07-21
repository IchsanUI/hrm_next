import { CalendarClock } from "lucide-react"

import { ModuleBlueprintPage } from "@/components/module-blueprint-page"

export default function PegawaiAbsensiPage() {
  return (
    <ModuleBlueprintPage
      breadcrumbItems={[
        { label: "Dashboard", href: "/pegawai/dashboard" },
        { label: "Riwayat Absensi" },
      ]}
      title="Riwayat Absensi"
      description="Rekap kehadiran Anda — jam masuk, jam pulang, dan status harian."
      icon={CalendarClock}
      plannedFeatures={[
        "Rekap hadir/terlambat/tidak hadir harian",
        "Terhubung mesin fingerprint",
        "Filter per periode",
      ]}
    />
  )
}
