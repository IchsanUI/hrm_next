import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { getIzinHistoryRows } from "@/lib/izin-history"
import { RiwayatIzinContent } from "@/components/riwayat-izin-content"

export default async function AdminRiwayatIzinPage() {
  const session = await auth()
  if (!session?.user.employeeId) {
    redirect("/admin/dashboard")
  }

  const rows = await getIzinHistoryRows(session.user.employeeId)

  return <RiwayatIzinContent izinRequests={rows} basePath="/admin" />
}
