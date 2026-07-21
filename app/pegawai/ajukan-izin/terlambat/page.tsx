import { getIzinTypeBlockReason } from "@/lib/izin-type-settings"
import { LateArrivalRequestForm } from "@/components/late-arrival-request-form"

export default async function AjukanIzinTerlambatPage() {
  const disabledReason = await getIzinTypeBlockReason("IZIN_TERLAMBAT")

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold">Ajukan Izin Terlambat</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Ajukan real-time saat Anda masih dalam perjalanan dan akan terlambat.
      </p>
      <LateArrivalRequestForm disabledReason={disabledReason} />
    </div>
  )
}
