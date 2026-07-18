"use client"

import { toast } from "sonner"
import {
  CalendarCheck2,
  FileClock,
  Users,
  Wallet,
  Clock,
  type LucideIcon,
} from "lucide-react"

import { Breadcrumb } from "@/components/breadcrumb"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type ReportOption = {
  label: string
  description: string
  icon: LucideIcon
}

const REPORTS: ReportOption[] = [
  {
    label: "Laporan Kehadiran",
    description: "Rekap kehadiran & keterlambatan pegawai per periode.",
    icon: CalendarCheck2,
  },
  {
    label: "Laporan Izin & Cuti",
    description: "Rekap pengajuan izin, cuti, dan sakit per pegawai/bagian.",
    icon: FileClock,
  },
  {
    label: "Laporan Data Pegawai",
    description: "Ekspor data kepegawaian lengkap untuk kebutuhan pelaporan.",
    icon: Users,
  },
  {
    label: "Laporan Lembur",
    description: "Rekap pengajuan & realisasi lembur pegawai.",
    icon: Clock,
  },
  {
    label: "Laporan Payroll",
    description: "Rekap gaji & tunjangan (menyusul setelah modul payroll aktif).",
    icon: Wallet,
  },
]

export default function LaporanPage() {
  function handleOpen(label: string) {
    toast.info(`"${label}" akan didiskusikan & dibangun bertahap.`)
  }

  return (
    <div>
      <Breadcrumb
        items={[
          { label: "Dashboard", href: "/admin/dashboard" },
          { label: "Laporan" },
        ]}
      />
      <h1 className="mb-1 text-2xl font-semibold">Laporan</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Kumpulan laporan rekap data kepegawaian, kehadiran, dan izin. Fitur ini
        akan dibangun bertahap.
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {REPORTS.map((report) => {
          const Icon = report.icon
          return (
            <Card key={report.label}>
              <CardHeader className="flex-row items-start gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Icon className="size-4.5" />
                </span>
                <div>
                  <CardTitle>{report.label}</CardTitle>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {report.description}
                  </p>
                </div>
              </CardHeader>
              <CardContent className="border-t pt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleOpen(report.label)}
                >
                  Lihat Laporan
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
