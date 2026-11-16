import { redirect } from "next/navigation"

// Dipindah ke Monitoring System → Monitoring Penyimpanan. Dipertahankan untuk link lama.
export default function MonitoringPenyimpananRedirect() {
  redirect("/admin/monitoring-system/penyimpanan")
}
