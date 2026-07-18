import { EarlyLeaveRequestForm } from "@/components/early-leave-request-form"

export default function AjukanIzinPulangCepatPage() {
  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold">Ajukan Izin Pulang Cepat</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Isi rencana pulang cepat sebelum Anda meninggalkan kantor.
      </p>
      <EarlyLeaveRequestForm />
    </div>
  )
}
