import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { getIzinTypeSettings } from "@/lib/izin-type-settings"
import { Breadcrumb } from "@/components/breadcrumb"
import { IzinTypeSettingsTable } from "@/components/izin-type-settings-table"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

export default async function PengaturanIzinPage() {
  const session = await auth()
  if (session?.user.role !== "SUPER_ADMIN") {
    redirect("/admin/dashboard")
  }

  const settings = await getIzinTypeSettings()

  return (
    <div className="grid gap-6">
      <Breadcrumb
        items={[
          { label: "Dashboard", href: "/admin/dashboard" },
          { label: "Izin" },
          { label: "Pengaturan Izin" },
        ]}
      />
      <Card>
        <CardHeader>
          <CardTitle>Pengaturan Izin</CardTitle>
          <CardDescription>
            Aktif/nonaktifkan jenis izin secara organisasi, dan atur batas jam pengajuan
            harian untuk jenis izin yang diajukan hari itu juga (Lembur, Meninggalkan
            Kantor, Sakit, Pulang Cepat, Terlambat). Kalau dinonaktifkan atau sudah lewat
            batas jam, pegawai tidak bisa mengajukan jenis izin tersebut sampai
            diaktifkan/hari berikutnya.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <IzinTypeSettingsTable settings={settings} />
        </CardContent>
      </Card>
    </div>
  )
}
