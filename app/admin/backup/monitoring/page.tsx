import { redirect } from "next/navigation"
import { Database } from "lucide-react"

import { auth } from "@/auth"
import { ModuleBlueprintPage } from "@/components/module-blueprint-page"

export default async function MonitoringPenyimpananPage() {
  const session = await auth()
  if (session?.user.role !== "SUPER_ADMIN") {
    redirect("/admin/dashboard")
  }

  return (
    <ModuleBlueprintPage
      breadcrumbItems={[
        { label: "Dashboard", href: "/admin/dashboard" },
        { label: "Backup" },
        { label: "Monitoring Penyimpanan" },
      ]}
      title="Monitoring Penyimpanan"
      description="Pantau seberapa besar data yang tersimpan di sistem, per modul, supaya bisa diputuskan kapan perlu backup/arsip manual."
      icon={Database}
      plannedFeatures={[
        "Estimasi ukuran data per modul (mis. Data Pegawai, Absensi/Log Fingerprint, Payroll & Slip Gaji, Log Aktivitas)",
        "Total ukuran database saat ini & tren pertumbuhan dari waktu ke waktu",
        "Rekomendasi data yang aman diarsipkan/dibersihkan (mis. Log Absensi atau Log Aktivitas yang sudah lama & sudah pernah di-backup)",
        "Peringatan otomatis kalau penyimpanan server mendekati batas kapasitas",
        "Tombol pintasan langsung ke Backup Manual untuk modul yang volumenya besar",
      ]}
    />
  )
}
