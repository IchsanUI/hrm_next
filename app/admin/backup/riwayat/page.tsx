import { redirect } from "next/navigation"
import { History } from "lucide-react"

import { auth } from "@/auth"
import { ModuleBlueprintPage } from "@/components/module-blueprint-page"

export default async function RiwayatBackupPage() {
  const session = await auth()
  if (session?.user.role !== "SUPER_ADMIN") {
    redirect("/admin/dashboard")
  }

  return (
    <ModuleBlueprintPage
      breadcrumbItems={[
        { label: "Dashboard", href: "/admin/dashboard" },
        { label: "Backup" },
        { label: "Riwayat Backup" },
      ]}
      title="Riwayat Backup"
      description="Daftar seluruh backup yang pernah dibuat — baik manual maupun terjadwal otomatis."
      icon={History}
      plannedFeatures={[
        "Daftar backup: tanggal & waktu, ukuran file, cakupan (seluruh/per modul), pemicu (manual oleh siapa/otomatis), status (sukses/gagal)",
        "Unduh ulang file backup lama kapan saja",
        "Hapus backup lama secara manual untuk membebaskan ruang penyimpanan",
        "Filter berdasarkan rentang tanggal dan jenis backup (manual/otomatis)",
        "Detail log kalau ada backup yang gagal (penyebab, bisa dicoba ulang)",
      ]}
    />
  )
}
