import { auth } from "@/auth"
import { getIzinHistoryRows } from "@/lib/izin-history"
import { RiwayatIzinContent } from "@/components/riwayat-izin-content"

export default async function RiwayatIzinPage() {
  const session = await auth()
  const rows = await getIzinHistoryRows(session?.user.employeeId)

  return <RiwayatIzinContent izinRequests={rows} basePath="/pegawai" />
}
