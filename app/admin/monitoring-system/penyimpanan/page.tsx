import Link from "next/link"
import { redirect } from "next/navigation"
import {
  AlertTriangle,
  Database,
  DatabaseBackup,
  FolderOpen,
  HardDrive,
  Layers,
  TrendingUp,
  XCircle,
} from "lucide-react"

import { auth } from "@/auth"
import { cn } from "@/lib/utils"
import {
  getDiskUsage,
  getFolderSizes,
  getSnapshots,
  getTableSizes,
  groupByModule,
  recordStorageSnapshot,
} from "@/lib/storage-monitoring"
import { Breadcrumb } from "@/components/breadcrumb"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { StorageTrendChart } from "@/components/storage-trend-chart"

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`
  if (bytes < 1024 ** 4) return `${(bytes / 1024 ** 3).toFixed(1)} GB`
  return `${(bytes / 1024 ** 4).toFixed(2)} TB`
}

// Batas peringatan kapasitas disk server.
const DISK_WARNING_PERCENT = 80
const DISK_CRITICAL_PERCENT = 90

type Tone = "good" | "warning" | "critical"
const TONE_CLASS: Record<Tone, string> = {
  good: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  warning: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  critical: "bg-rose-500/15 text-rose-700 dark:text-rose-400",
}
const TONE_BAR: Record<Tone, string> = {
  good: "bg-emerald-500",
  warning: "bg-amber-500",
  critical: "bg-rose-500",
}

function SectionHeader({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Database
  title: string
  description: string
}) {
  return (
    <CardHeader className="border-b px-5 py-4 [.border-b]:pb-4">
      <div className="flex items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-4" />
        </span>
        <div className="min-w-0">
          <CardTitle className="text-base">{title}</CardTitle>
          <CardDescription className="mt-0.5 text-xs">{description}</CardDescription>
        </div>
      </div>
    </CardHeader>
  )
}

function Bar({ percent, className }: { percent: number; className?: string }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
      <div
        className={cn("h-full rounded-full", className)}
        style={{ width: `${Math.min(100, Math.max(percent > 0 ? 1.5 : 0, percent))}%`, ...(className ? {} : { backgroundColor: "var(--chart-1)" }) }}
      />
    </div>
  )
}

export default async function MonitoringPenyimpananPage() {
  const session = await auth()
  if (session?.user.role !== "SUPER_ADMIN") {
    redirect("/admin/dashboard")
  }

  const [tables, folders, disk] = await Promise.all([
    getTableSizes(),
    getFolderSizes(),
    getDiskUsage(),
  ])
  const modules = groupByModule(tables)
  const databaseBytes = tables.reduce((sum, t) => sum + t.bytes, 0)
  const filesBytes = folders.reduce((sum, f) => sum + f.bytes, 0)
  const totalBytes = databaseBytes + filesBytes

  // Catat snapshot hari ini (juga dilakukan scheduler tiap 6 jam), lalu ambil tren.
  await recordStorageSnapshot({ databaseBytes, filesBytes }).catch(() => {})
  const snapshots = await getSnapshots(30)

  const diskTone: Tone = !disk
    ? "warning"
    : disk.usedPercent >= DISK_CRITICAL_PERCENT
      ? "critical"
      : disk.usedPercent >= DISK_WARNING_PERCENT
        ? "warning"
        : "good"
  const largestModule = Math.max(1, ...modules.map((m) => m.bytes))
  const largestFolder = Math.max(1, ...folders.map((f) => f.bytes))

  const summary = [
    { label: "Database", value: formatBytes(databaseBytes), hint: `${tables.length} tabel`, icon: Database },
    {
      label: "File tersimpan",
      value: formatBytes(filesBytes),
      hint: `${folders.reduce((s, f) => s + f.files, 0).toLocaleString("id-ID")} file`,
      icon: FolderOpen,
    },
    { label: "Total data aplikasi", value: formatBytes(totalBytes), hint: "Database + file", icon: Layers },
  ]

  return (
    <div>
      <Breadcrumb
        items={[
          { label: "Dashboard", href: "/admin/dashboard" },
          { label: "Monitoring System" },
          { label: "Monitoring Penyimpanan" },
        ]}
      />
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Monitoring Penyimpanan</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ukuran data per modul, file yang tersimpan, kapasitas disk server, dan tren pertumbuhannya.
        </p>
      </div>

      {disk && diskTone !== "good" ? (
        <div
          className={cn(
            "mb-6 flex items-start gap-3 rounded-lg border p-4",
            diskTone === "critical" ? "border-rose-500/40 bg-rose-500/10" : "border-amber-500/40 bg-amber-500/10"
          )}
        >
          {diskTone === "critical" ? (
            <XCircle className="mt-0.5 size-5 shrink-0 text-rose-600 dark:text-rose-400" />
          ) : (
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" />
          )}
          <div className="text-sm">
            <p className="font-medium">
              Disk server terpakai {disk.usedPercent.toFixed(0)}% — sisa {formatBytes(disk.freeBytes)}
            </p>
            <p className="text-xs text-muted-foreground">
              {diskTone === "critical"
                ? "Segera kosongkan ruang: unduh lalu hapus backup lama, atau arsipkan data lama di bawah."
                : `Sudah melewati batas peringatan ${DISK_WARNING_PERCENT}%. Pertimbangkan mengarsipkan data lama.`}
            </p>
          </div>
        </div>
      ) : null}

      {/* Ringkasan */}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {summary.map((item) => {
          const Icon = item.icon
          return (
            <Card key={item.label}>
              <CardContent className="flex items-center gap-3 px-5">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="size-5" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-xs text-muted-foreground">{item.label}</p>
                  <p className="truncate text-lg leading-tight font-semibold tabular-nums">{item.value}</p>
                  <p className="truncate text-xs text-muted-foreground">{item.hint}</p>
                </div>
              </CardContent>
            </Card>
          )
        })}
        <Card>
          <CardContent className="flex items-center gap-3 px-5">
            <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg", TONE_CLASS[diskTone])}>
              <HardDrive className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs text-muted-foreground">Disk server</p>
              {disk ? (
                <>
                  <p className="truncate text-lg leading-tight font-semibold tabular-nums">
                    {disk.usedPercent.toFixed(0)}% <span className="text-xs font-normal text-muted-foreground">terpakai</span>
                  </p>
                  <div className="mt-1.5">
                    <Bar percent={disk.usedPercent} className={TONE_BAR[diskTone]} />
                  </div>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    Sisa {formatBytes(disk.freeBytes)} dari {formatBytes(disk.totalBytes)}
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Tidak dapat dibaca</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        {/* Per modul */}
        <Card className="gap-0 py-0">
          <SectionHeader
            icon={Layers}
            title="Ukuran Data per Modul"
            description="Dikelompokkan sama seperti cakupan Backup Database. Angka baris dari statistik MySQL (perkiraan)."
          />
          <CardContent className="p-0">
            <ul className="divide-y">
              {modules.map((m) => (
                <li key={m.label} className="grid gap-2 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-6">
                  <div className="min-w-0">
                    <div className="mb-1.5 flex items-baseline justify-between gap-3">
                      <p className="font-medium">{m.label}</p>
                      <p className="shrink-0 text-sm font-semibold tabular-nums">
                        {formatBytes(m.bytes)}
                        <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                          {databaseBytes > 0 ? `${((m.bytes / databaseBytes) * 100).toFixed(0)}%` : ""}
                        </span>
                      </p>
                    </div>
                    <Bar percent={(m.bytes / largestModule) * 100} />
                    <p className="mt-1.5 truncate text-xs text-muted-foreground">
                      {m.tables.length} tabel · ±{m.rows.toLocaleString("id-ID")} baris · terbesar:{" "}
                      {m.tables
                        .slice(0, 3)
                        .map((t) => `${t.table} (${formatBytes(t.bytes)})`)
                        .join(", ")}
                    </p>
                  </div>
                  {m.scope ? (
                    <Link
                      href={`/admin/backup/database?scope=${m.scope}`}
                      className="inline-flex w-fit items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition hover:bg-muted"
                    >
                      <DatabaseBackup className="size-3.5" />
                      Backup modul ini
                    </Link>
                  ) : (
                    <span className="text-xs text-muted-foreground sm:text-right">Hanya di backup penuh</span>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* File */}
        <Card className="gap-0 py-0">
          <SectionHeader icon={FolderOpen} title="Penyimpanan File" description="Folder file di server aplikasi." />
          <CardContent className="grid gap-5 p-5">
            {folders.map((f) => (
              <div key={f.key}>
                <div className="mb-1.5 flex items-baseline justify-between gap-3">
                  <p className="text-sm font-medium">{f.label}</p>
                  <p className="shrink-0 text-sm font-semibold tabular-nums">{formatBytes(f.bytes)}</p>
                </div>
                <Bar percent={(f.bytes / largestFolder) * 100} />
                <p className="mt-1.5 flex justify-between gap-2 text-xs text-muted-foreground">
                  <span className="truncate font-mono">{f.path}</span>
                  <span className="shrink-0">{f.files.toLocaleString("id-ID")} file</span>
                </p>
              </div>
            ))}
            <div className="flex flex-wrap gap-2 border-t pt-4">
              <Link
                href="/admin/backup/database/riwayat"
                className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition hover:bg-muted"
              >
                Kelola file backup
              </Link>
              <Link
                href="/admin/backup/arsip"
                className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition hover:bg-muted"
              >
                Arsipkan data lama
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Tren */}
        <Card className="gap-0 py-0 xl:col-span-2">
          <SectionHeader
            icon={TrendingUp}
            title="Tren Pertumbuhan (30 Hari)"
            description="Total database + file, dicatat sekali per hari. Arahkan kursor ke kolom untuk rincian."
          />
          <CardContent className="p-5">
            <StorageTrendChart points={snapshots} />
          </CardContent>
        </Card>

      </div>
    </div>
  )
}
