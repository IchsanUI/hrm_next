import { redirect } from "next/navigation"
import { Save } from "lucide-react"

import { auth } from "@/auth"
import { ModuleBlueprintPage } from "@/components/module-blueprint-page"

export default async function BackupManualPage() {
  const session = await auth()
  if (session?.user.role !== "SUPER_ADMIN") {
    redirect("/admin/dashboard")
  }

  return (
    <ModuleBlueprintPage
      breadcrumbItems={[
        { label: "Dashboard", href: "/admin/dashboard" },
        { label: "Backup" },
        { label: "Backup Manual" },
      ]}
      title="Backup Manual"
      description="Picu backup database kapan saja tanpa menunggu jadwal otomatis — meringankan beban penyimpanan server saat dibutuhkan."
      icon={Save}
      plannedFeatures={[
        "Tombol \"Backup Sekarang\" untuk memicu dump database on-demand",
        "Pilih cakupan backup — seluruh database, atau per modul (mis. cuma Kepegawaian, cuma Payroll & Absensi)",
        "Indikator progres & status saat backup sedang berjalan (tidak memblokir aktivitas admin lain)",
        "Hasil backup bisa diunduh langsung, disimpan di server, atau dikirim ke penyimpanan eksternal (mis. Google Drive/S3)",
        "Kebijakan retensi otomatis — backup lama dihapus otomatis sesuai batas yang diatur, biar tidak memenuhi storage",
        "Hanya bisa diakses SUPER_ADMIN — mengingat berisi seluruh data sensitif sistem",
      ]}
    />
  )
}
