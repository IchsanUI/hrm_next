import { OvertimeRequestForm } from "@/components/overtime-request-form"

export default function AjukanIzinLemburPage() {
  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold">Ajukan Izin Lembur</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Tahap 1 dari 2 — Pengajuan rencana lembur.
      </p>
      <OvertimeRequestForm />
    </div>
  )
}
