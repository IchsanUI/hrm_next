"use client"

import { useState } from "react"
import { toast } from "sonner"
import {
  CalendarCheck2,
  FileClock,
  Users,
  Wallet,
  Clock,
  FileSpreadsheet,
  type LucideIcon,
} from "lucide-react"

import { Breadcrumb } from "@/components/breadcrumb"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ReportMonthDialog, type SuratReportOption } from "@/components/report-month-dialog"

type ReportOption = {
  label: string
  description: string
  icon: LucideIcon
  // Kalau ada, tombolnya jadi link download langsung ke route ini alih-alih toast stub.
  downloadHref?: string
  // Tombol unduhan kedua (opsional) — mis. versi lengkap per-pegawai (satu sheet per orang).
  downloadHrefFull?: string
  downloadFullLabel?: string
  // Kalau ada, kartu ini render beberapa tombol Type Surat (bukan satu tombol
  // "Lihat Laporan") — tiap tombol buka modal pemilihan bulan.
  suratOptions?: SuratReportOption[]
}

const SURAT_IZIN_CUTI: SuratReportOption[] = [
  { key: "rekap-absen-kpi", label: "Rekap Absen (KPI)", downloadPath: "/api/laporan/rekap-absen-kpi" },
  { key: "rekap-absen-gaji", label: "Rekap Absen (Gaji)" },
  { key: "rekap-ijin-kpi", label: "Rekap Ijin (KPI)" },
  { key: "rekap-ijin-gaji", label: "Rekap Ijin (Gaji)" },
]

const SURAT_LEMBUR: SuratReportOption[] = [
  { key: "rekap-lembur", label: "Rekap Lembur", downloadPath: "/api/laporan/rekap-lembur" },
]

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
    suratOptions: SURAT_IZIN_CUTI,
  },
  {
    label: "Laporan Data Pegawai",
    description: "Ekspor data kepegawaian lengkap untuk kebutuhan pelaporan.",
    icon: Users,
    downloadHref: "/api/laporan/data-pegawai",
    downloadHrefFull: "/api/laporan/data-pegawai-full",
    downloadFullLabel: "Unduh Data Pegawai Full",
  },
  {
    label: "Laporan Lembur",
    description: "Rekap pengajuan & realisasi lembur pegawai.",
    icon: Clock,
    suratOptions: SURAT_LEMBUR,
  },
  {
    label: "Laporan Payroll",
    description: "Rekap gaji & tunjangan (menyusul setelah modul payroll aktif).",
    icon: Wallet,
  },
]

export default function LaporanPage() {
  const [activeSurat, setActiveSurat] = useState<SuratReportOption | null>(null)

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
              <CardContent className="flex flex-wrap gap-2 border-t pt-4">
                {report.suratOptions ? (
                  report.suratOptions.map((surat) => (
                    <Button
                      key={surat.key}
                      variant="outline"
                      size="sm"
                      onClick={() => setActiveSurat(surat)}
                    >
                      {surat.downloadPath ? (
                        <FileSpreadsheet className="size-3.5 text-emerald-600" />
                      ) : null}
                      {surat.label}
                    </Button>
                  ))
                ) : report.downloadHref ? (
                  <Button
                    variant="outline"
                    size="sm"
                    nativeButton={false}
                    render={<a href={report.downloadHref} download />}
                  >
                    <FileSpreadsheet className="size-3.5 text-emerald-600" />
                    Unduh Laporan
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpen(report.label)}
                  >
                    Lihat Laporan
                  </Button>
                )}
                {report.downloadHrefFull ? (
                  <Button
                    variant="outline"
                    size="sm"
                    nativeButton={false}
                    render={<a href={report.downloadHrefFull} download />}
                  >
                    <FileSpreadsheet className="size-3.5 text-emerald-600" />
                    {report.downloadFullLabel ?? "Unduh Laporan Lengkap"}
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          )
        })}
      </div>

      <ReportMonthDialog
        report={activeSurat}
        onOpenChange={(open) => !open && setActiveSurat(null)}
      />
    </div>
  )
}
