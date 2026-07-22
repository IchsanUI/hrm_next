import { getIzinTypeBlockReason } from "@/lib/izin-type-settings"
import { Breadcrumb } from "@/components/breadcrumb"
import { EarlyLeaveRequestForm } from "@/components/early-leave-request-form"

export default async function AjukanIzinPulangCepatPage() {
  const disabledReason = await getIzinTypeBlockReason("IZIN_PULANG_CEPAT")

  return (
    <div>
      <Breadcrumb
        items={[
          { label: "Dashboard", href: "/pegawai/dashboard" },
          { label: "Ajukan Izin", href: "/pegawai/ajukan-izin" },
          { label: "Izin Pulang Cepat" },
        ]}
      />
      <h1 className="mb-1 text-2xl font-semibold">Ajukan Izin Pulang Cepat</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Isi rencana pulang cepat sebelum Anda meninggalkan kantor.
      </p>
      <EarlyLeaveRequestForm disabledReason={disabledReason} />
    </div>
  )
}
