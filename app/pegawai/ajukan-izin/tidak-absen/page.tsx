import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { getIzinTypeBlockReason } from "@/lib/izin-type-settings"
import { Breadcrumb } from "@/components/breadcrumb"
import { AttendanceStatementRequestForm } from "@/components/attendance-statement-request-form"

export default async function AjukanIzinTidakAbsenPage() {
  const session = await auth()
  if (!session?.user.employeeId) {
    redirect("/login")
  }

  const disabledReason = await getIzinTypeBlockReason("IZIN_TIDAK_ABSEN", session.user.employeeId)

  return (
    <div>
      <Breadcrumb
        items={[
          { label: "Dashboard", href: "/pegawai/dashboard" },
          { label: "Ajukan Izin", href: "/pegawai/ajukan-izin" },
          { label: "Izin Tidak Absen Datang/Pulang" },
        ]}
      />
      <h1 className="mb-1 text-2xl font-semibold">Pernyataan Tidak Absen Datang/Pulang</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Isi kalau Anda lupa/lalai melakukan presensi fingerprint.
      </p>
      <AttendanceStatementRequestForm disabledReason={disabledReason} />
    </div>
  )
}
