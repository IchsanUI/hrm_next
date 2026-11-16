import { redirect } from "next/navigation"

// Halaman induk grup Monitoring System → Monitoring Dashboard. Dashboard-nya
// sengaja di sub-path sendiri supaya menu sidebar tidak ikut "aktif" saat
// membuka sub-menu lain (pencocokan aktif berbasis awalan URL).
export default function MonitoringSystemIndex() {
  redirect("/admin/monitoring-system/dashboard")
}
