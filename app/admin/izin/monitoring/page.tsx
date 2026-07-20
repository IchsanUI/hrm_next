import { auth } from "@/auth"
import { Breadcrumb } from "@/components/breadcrumb"
import { IzinMonitoringFilters } from "@/components/izin-monitoring-filters"
import { IzinMonitoringTable } from "@/components/izin-monitoring-table"
import {
  getIzinMonitoringRows,
  IZIN_MONITORING_KIND_OPTIONS,
  type IzinMonitoringRow,
} from "@/lib/izin-monitoring"

type IzinKind = IzinMonitoringRow["kind"]

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

const KIND_VALUES = new Set<IzinKind>(IZIN_MONITORING_KIND_OPTIONS.map((o) => o.value))

export default async function MonitoringIzinPage({
  searchParams,
}: {
  searchParams: Promise<{ dari?: string; sampai?: string; jenis?: string }>
}) {
  const session = await auth()
  const params = await searchParams
  const today = todayDateValue()
  const dari = parseDateValue(params.dari, firstOfMonthValue())
  const sampai = parseDateValue(params.sampai, today)
  const jenisParam = params.jenis as IzinKind | undefined
  const kind = jenisParam && KIND_VALUES.has(jenisParam) ? jenisParam : undefined

  const startDate = new Date(`${dari}T00:00:00`)
  const endDate = new Date(`${sampai}T23:59:59.999`)

  const rows = await getIzinMonitoringRows({ startDate, endDate, kind })

  return (
    <div>
      <Breadcrumb
        items={[
          { label: "Dashboard", href: "/admin/dashboard" },
          { label: "Izin" },
          { label: "Monitoring Izin" },
        ]}
      />
      <h1 className="mb-1 text-2xl font-semibold">Monitoring Izin</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Semua pengajuan izin/cuti organisasi, lintas bagian — bukan cuma
        antrean approval milik sendiri seperti di Approval Center.
      </p>
      <IzinMonitoringTable
        rows={rows}
        isSuperAdmin={session?.user.role === "SUPER_ADMIN"}
        filters={
          <IzinMonitoringFilters
            key="izin-monitoring-filters"
            initialKind={kind ?? ""}
            initialFrom={dari}
            initialTo={sampai}
          />
        }
      />
    </div>
  )
}
