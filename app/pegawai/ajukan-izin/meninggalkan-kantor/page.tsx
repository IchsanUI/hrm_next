import { OfficeExitRequestForm } from "@/components/office-exit-request-form"

export default function AjukanIzinMeninggalkanKantorPage() {
  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold">Ajukan Izin Meninggalkan Kantor</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Isi rencana keluar kantor sebelum Anda meninggalkan kantor.
      </p>
      <OfficeExitRequestForm />
    </div>
  )
}
