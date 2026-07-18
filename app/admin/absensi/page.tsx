"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { UserCheck, Clock3, UserX, CalendarOff } from "lucide-react"

import { Breadcrumb } from "@/components/breadcrumb"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { DataTable } from "@/components/data-table"

type AttendanceRow = {
  id: number
  employee: string
  date: string
  checkIn: string
  checkOut: string
  status: string
}

const columns: ColumnDef<AttendanceRow, unknown>[] = [
  { accessorKey: "employee", header: "Nama Pegawai" },
  { accessorKey: "date", header: "Tanggal" },
  { accessorKey: "checkIn", header: "Jam Masuk" },
  { accessorKey: "checkOut", header: "Jam Pulang" },
  {
    id: "status",
    header: "Status",
    cell: () => <Badge variant="secondary">-</Badge>,
  },
]

const STATS = [
  { label: "Hadir Hari Ini", value: 0, icon: UserCheck },
  { label: "Terlambat", value: 0, icon: Clock3 },
  { label: "Tidak Hadir", value: 0, icon: UserX },
  { label: "Cuti / Izin", value: 0, icon: CalendarOff },
]

export default function AbsensiPage() {
  return (
    <div>
      <Breadcrumb
        items={[
          { label: "Dashboard", href: "/admin/dashboard" },
          { label: "Absensi" },
        ]}
      />
      <h1 className="mb-1 text-2xl font-semibold">Absensi</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Rekap kehadiran pegawai. Akan terhubung dengan mesin fingerprint pada
        pengembangan selanjutnya.
      </p>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STATS.map((stat) => {
          const Icon = stat.icon
          return (
            <Card key={stat.label}>
              <CardContent className="flex items-center gap-3 py-5">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Icon className="size-5" />
                </span>
                <div>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                  <p className="text-xl font-bold">{stat.value}</p>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <DataTable
        columns={columns}
        data={[] as AttendanceRow[]}
        searchPlaceholder="Cari nama pegawai..."
        emptyMessage="Belum ada data absensi."
      />
    </div>
  )
}
