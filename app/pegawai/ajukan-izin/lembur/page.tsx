import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { getIzinTypeBlockReason, redirectIfIzinTypeInactive } from "@/lib/izin-type-settings"
import { Breadcrumb } from "@/components/breadcrumb"
import { OvertimeRequestForm } from "@/components/overtime-request-form"

export default async function AjukanIzinLemburPage() {
  const session = await auth()
  if (!session?.user.employeeId) {
    redirect("/login")
  }
  await redirectIfIzinTypeInactive("IZIN_LEMBUR")

  const disabledReason = await getIzinTypeBlockReason("IZIN_LEMBUR", session.user.employeeId)

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
