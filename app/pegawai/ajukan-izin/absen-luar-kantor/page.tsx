import { getIzinTypeBlockReason } from "@/lib/izin-type-settings"
import { Breadcrumb } from "@/components/breadcrumb"
import { OffSiteAttendanceRequestForm } from "@/components/off-site-attendance-request-form"

export default async function AjukanIzinAbsenLuarKantorPage() {
  const disabledReason = await getIzinTypeBlockReason("IZIN_ABSEN_LUAR_KANTOR")

  return (
    <div>
      <Breadcrumb
        items={[
          { label: "Dashboard", href: "/pegawai/dashboard" },
          { label: "Ajukan Izin", href: "/pegawai/ajukan-izin" },
          { label: "Izin Absen Diluar Kantor" },
        ]}
      />
      <h1 className="mb-1 text-2xl font-semibold">Ajukan Izin Absen Diluar Kantor</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Isi kalau Anda dinas/bekerja di luar kantor sehingga tidak bisa absen fingerprint.
      </p>
      <OffSiteAttendanceRequestForm disabledReason={disabledReason} />
    </div>
  )
}
