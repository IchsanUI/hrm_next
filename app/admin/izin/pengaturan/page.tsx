import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { getIzinTypeSettings } from "@/lib/izin-type-settings"
import { Breadcrumb } from "@/components/breadcrumb"
import { IzinTypeSettingsTable } from "@/components/izin-type-settings-table"
import { IzinLetterheadForm } from "@/components/izin-letterhead-form"
import { OvertimeAutoRejectToggle } from "@/components/overtime-auto-reject-toggle"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

export default async function PengaturanIzinPage() {
  const session = await auth()
  const isAdminRole = session?.user.role === "SUPER_ADMIN" || session?.user.role === "HR_ADMIN"
  const hasAccess =
    session?.user.role === "SUPER_ADMIN" ||
    session?.user.menuAccess.includes("approval.pengaturan")
  if (!isAdminRole || !hasAccess) {
    redirect("/admin/dashboard")
  }

  const [settings, izinSettings] = await Promise.all([
    getIzinTypeSettings(),
    prisma.izinSettings.findUnique({ where: { id: 1 } }),
  ])

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

      <IzinLetterheadForm letterheadUrl={izinSettings?.letterheadUrl ?? null} />

      <OvertimeAutoRejectToggle
        enabled={izinSettings?.overtimeAutoRejectEnabled ?? true}
        canManage={session?.user.role === "SUPER_ADMIN"}
      />
    </div>
  )
}
