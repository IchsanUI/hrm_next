import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { getIzinTypeBlockReason } from "@/lib/izin-type-settings"
import { Breadcrumb } from "@/components/breadcrumb"
import { LateArrivalRequestForm } from "@/components/late-arrival-request-form"

export default async function AjukanIzinTerlambatPage() {
  const session = await auth()
  if (!session?.user.employeeId) {
    redirect("/login")
  }

  const disabledReason = await getIzinTypeBlockReason("IZIN_TERLAMBAT", session.user.employeeId)

  return (
    <div>
      <Breadcrumb
        items={[
          { label: "Dashboard", href: "/pegawai/dashboard" },
          { label: "Ajukan Izin", href: "/pegawai/ajukan-izin" },
          { label: "Izin Terlambat" },
        ]}
      />
      <h1 className="mb-1 text-2xl font-semibold">Ajukan Izin Terlambat</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Ajukan real-time saat Anda masih dalam perjalanan dan akan terlambat.
      </p>
      <LateArrivalRequestForm disabledReason={disabledReason} />
    </div>
  )
}
