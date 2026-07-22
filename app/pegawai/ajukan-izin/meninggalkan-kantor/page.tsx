import { getIzinTypeBlockReason } from "@/lib/izin-type-settings"
import { Breadcrumb } from "@/components/breadcrumb"
import { OfficeExitRequestForm } from "@/components/office-exit-request-form"

export default async function AjukanIzinMeninggalkanKantorPage() {
  const disabledReason = await getIzinTypeBlockReason("IZIN_MENINGGALKAN_KANTOR")

  return (
    <div>
      <Breadcrumb
        items={[
          { label: "Dashboard", href: "/pegawai/dashboard" },
          { label: "Ajukan Izin", href: "/pegawai/ajukan-izin" },
          { label: "Izin Meninggalkan Kantor" },
        ]}
      />
      <h1 className="mb-1 text-2xl font-semibold">Ajukan Izin Meninggalkan Kantor</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Isi rencana keluar kantor sebelum Anda meninggalkan kantor.
      </p>
      <OfficeExitRequestForm disabledReason={disabledReason} />
    </div>
  )
}
