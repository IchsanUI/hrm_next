import { prisma } from "@/lib/prisma"
import { Breadcrumb } from "@/components/breadcrumb"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AttendanceDeviceTable } from "@/components/attendance-device-table"
import { AttendanceSettingsForm } from "@/components/attendance-settings-form"

export default async function PengaturanAbsensiPage() {
  const [devices, settings] = await Promise.all([
    prisma.attendanceDevice.findMany({ orderBy: { id: "asc" } }),
    prisma.attendanceSettings.findUnique({ where: { id: 1 } }),
  ])

  return (
    <div className="grid gap-6">
      <Breadcrumb
        items={[
          { label: "Dashboard", href: "/admin/dashboard" },
          { label: "Absensi" },
          { label: "Pengaturan Absensi" },
        ]}
      />
      <div>
        <h1 className="text-2xl font-semibold">Pengaturan Absensi</h1>
        <p className="text-sm text-muted-foreground">
          Kelola mesin fingerprint yang datanya diambil ke Data Absensi.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <AttendanceDeviceTable devices={devices} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sinkronisasi Otomatis</CardTitle>
          <CardDescription>
            Server otomatis mengambil data absensi dari semua mesin aktif — pilih mode
            Interval (berkala tiap N detik sepanjang hari) atau Jadwal (cuma di jam:menit
            tertentu, mis. 08:00, 12:00, 17:00). Tombol &quot;Ambil Data Mesin&quot; di
            halaman Data Absensi tetap bisa dipakai kapan saja buat ambil data manual.
            Perubahan berlaku di siklus berikutnya, tanpa perlu restart server.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AttendanceSettingsForm
            key={`${settings?.enabled ?? true}-${settings?.syncMode ?? "INTERVAL"}-${settings?.pollSeconds ?? 30}-${settings?.scheduledTimes ?? ""}`}
            enabled={settings?.enabled ?? true}
            syncMode={settings?.syncMode ?? "INTERVAL"}
            pollSeconds={settings?.pollSeconds ?? 30}
            scheduledTimes={settings?.scheduledTimes ?? ""}
          />
        </CardContent>
      </Card>
    </div>
  )
}
