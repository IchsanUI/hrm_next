import { prisma } from "@/lib/prisma"
import { Breadcrumb } from "@/components/breadcrumb"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AttendanceDeviceTable } from "@/components/attendance-device-table"
import { DeviceTimeSyncCard } from "@/components/device-time-sync-card"
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

      <DeviceTimeSyncCard deviceCount={devices.filter((d) => d.active).length} />

      <Card>
        <CardHeader>
          <CardTitle>Sinkronisasi Otomatis</CardTitle>
          <CardDescription>
            Server otomatis mengambil data absensi dari semua mesin aktif tiap interval yang
            diatur di bawah. Begitu ada data baru, pegawai bersangkutan otomatis dapat push
            notification "Absen Berhasil". Tombol &quot;Ambil Data Mesin&quot; di halaman Data
            Absensi tetap bisa dipakai kapan saja buat ambil data manual (tanpa notifikasi).
            Perubahan berlaku di siklus berikutnya, tanpa perlu restart server.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AttendanceSettingsForm
            key={`${settings?.enabled ?? true}-${settings?.pollSeconds ?? 30}`}
            enabled={settings?.enabled ?? true}
            pollSeconds={settings?.pollSeconds ?? 30}
          />
        </CardContent>
      </Card>
    </div>
  )
}
