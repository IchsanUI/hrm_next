import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { getIzinHistoryRows } from "@/lib/izin-history"
import { IZIN_MONITORING_KIND_OPTIONS } from "@/lib/izin-monitoring-constants"
import type { IzinHistoryRow } from "@/components/riwayat-izin-content"
import { RiwayatIzinContent } from "@/components/riwayat-izin-content"
import { RiwayatIzinFilters } from "@/components/riwayat-izin-filters"

function todayDateValue() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
}

function firstOfMonthValue() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`
}

function parseDateValue(value: string | undefined, fallback: string) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : fallback
}

const KIND_VALUES = new Set(IZIN_MONITORING_KIND_OPTIONS.map((o) => o.value))

export default async function AdminRiwayatIzinPage({
  searchParams,
}: {
  searchParams: Promise<{ dari?: string; sampai?: string; jenis?: string }>
}) {
  const session = await auth()
  if (!session?.user.employeeId) {
    redirect("/admin/dashboard")
  }

  const params = await searchParams
  const today = todayDateValue()
  const dari = parseDateValue(params.dari, firstOfMonthValue())
  const sampai = parseDateValue(params.sampai, today)
  const jenisParam = params.jenis as IzinHistoryRow["kind"] | undefined
  const kind = jenisParam && KIND_VALUES.has(jenisParam) ? jenisParam : undefined

  const rows = await getIzinHistoryRows(session.user.employeeId, {
    startDate: new Date(`${dari}T00:00:00`),
    endDate: new Date(`${sampai}T23:59:59.999`),
    kind,
  })

  return (
    <RiwayatIzinContent
      izinRequests={rows}
      basePath="/admin"
      filters={
        <RiwayatIzinFilters
          key="riwayat-izin-filters"
          basePath="/admin"
          initialKind={kind ?? ""}
          initialFrom={dari}
          initialTo={sampai}
        />
      }
    />
  )
}
