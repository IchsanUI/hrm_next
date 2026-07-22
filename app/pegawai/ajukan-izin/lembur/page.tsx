import { getIzinTypeBlockReason } from "@/lib/izin-type-settings"
import { Breadcrumb } from "@/components/breadcrumb"
import { OvertimeRequestForm } from "@/components/overtime-request-form"

export default async function AjukanIzinLemburPage() {
  const disabledReason = await getIzinTypeBlockReason("IZIN_LEMBUR")

  return (
    <div>
      <Breadcrumb
        items={[
          { label: "Dashboard", href: "/pegawai/dashboard" },
          { label: "Ajukan Izin", href: "/pegawai/ajukan-izin" },
          { label: "Izin Lembur" },
        ]}
      />
      <h1 className="mb-1 text-2xl font-semibold">Ajukan Izin Lembur</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Tahap 1 dari 2 — Pengajuan rencana lembur.
      </p>
      <OvertimeRequestForm disabledReason={disabledReason} />
    </div>
  )
}
