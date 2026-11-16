import { redirect } from "next/navigation"
import { Archive, FileUp, History, ShieldCheck } from "lucide-react"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { ARCHIVE_MONTH_OPTIONS, ARCHIVE_TARGETS, isArchiveTarget } from "@/lib/archive/targets"
import { countArchivable, cutoffFromMonths, describeTarget } from "@/lib/archive/run-archive"
import { BACKUP_SCOPE_TABLES } from "@/lib/backup/table-groups"
import { Breadcrumb } from "@/components/breadcrumb"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ArchiveHistory,
  ArchiveTargets,
  ArchiveUpload,
  type ArchiveCounts,
  type ArchiveHistoryRow,
} from "@/components/archive-manager"

function scopeOfArchiveTarget(table: string) {
  const entry = Object.entries(BACKUP_SCOPE_TABLES).find(([, tables]) => tables.includes(table))
  return (entry?.[0] ?? "SISTEM") as keyof typeof BACKUP_SCOPE_TABLES
}

function SectionHeader({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Archive
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

export default async function ArsipDataPage() {
  const session = await auth()
  if (session?.user.role !== "SUPER_ADMIN") {
    redirect("/admin/dashboard")
  }

  const now = new Date()
  const entries = await Promise.all(
    ARCHIVE_TARGETS.flatMap((target) =>
      ARCHIVE_MONTH_OPTIONS.map(async (months) => {
        const cutoff = cutoffFromMonths(months, now)
        return { target, months, rows: await countArchivable(target, cutoff), cutoff: cutoff.toISOString() }
      })
    )
  )
  const counts = Object.fromEntries(ARCHIVE_TARGETS.map((t) => [t, {}])) as ArchiveCounts
  for (const e of entries) counts[e.target][e.months] = { rows: e.rows, cutoff: e.cutoff }

  // Backup database terakhir yang mencakup tabel tiap jenis data (cakupan
  // modulnya atau backup penuh) — ditampilkan di kartu sebagai info tambahan.
  const lastBackups = Object.fromEntries(
    await Promise.all(
      ARCHIVE_TARGETS.map(async (target) => {
        const scope = scopeOfArchiveTarget(target)
        const last = await prisma.backup.findFirst({
          where: { status: "SUCCESS", scope: { in: [scope, "ALL"] } },
          orderBy: { startedAt: "desc" },
          select: { startedAt: true },
        })
        return [target, last?.startedAt.toISOString() ?? null]
      })
    )
  ) as Record<(typeof ARCHIVE_TARGETS)[number], string | null>

  const archives = await prisma.dataArchive.findMany({ orderBy: { createdAt: "desc" }, take: 100 })
  const history: ArchiveHistoryRow[] = archives
    .filter((a) => isArchiveTarget(a.target))
    .map((a) => ({
      publicId: a.publicId,
      target: a.target as ArchiveHistoryRow["target"],
      targetLabel: describeTarget(a.target),
      cutoff: a.cutoff.toISOString(),
      rowCount: a.rowCount,
      fileName: a.fileName,
      fileSizeBytes: a.fileSizeBytes,
      onServer: !!a.filePath,
      createdAt: a.createdAt.toISOString(),
      createdByUsername: a.createdByUsername,
      lastRestoredAt: a.lastRestoredAt?.toISOString() ?? null,
      lastRestoredRows: a.lastRestoredRows,
    }))

  return (
    <div>
      <Breadcrumb
        items={[
          { label: "Dashboard", href: "/admin/dashboard" },
          { label: "Backup" },
          { label: "Arsip Data" },
        ]}
      />
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Arsip Data</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pindahkan data log lama dari database ke file arsip supaya server tetap bersih, lalu import ulang kapan
          saja bila dibutuhkan.
        </p>
      </div>

      <div className="mb-6 flex items-start gap-3 rounded-lg border bg-muted/40 p-4 text-sm">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" />
        <p className="text-muted-foreground">
          Hanya data log (absensi, aktivitas, notifikasi) yang bisa diarsipkan — data pegawai, payroll, dan izin
          tidak pernah dihapus dari sini. Alurnya: <span className="text-foreground">ekspor → verifikasi file →
          hapus dari database</span>. Setelah mengunduh file arsip, Anda bisa menghapusnya dari server agar
          benar-benar bersih.
        </p>
      </div>

      <div className="grid gap-6">
        <Card className="gap-0 py-0">
          <SectionHeader
            icon={Archive}
            title="Arsip & Bersihkan"
            description="Pilih batas umur data, lalu arsipkan. Maks. 200.000 baris per proses (yang paling lama duluan)."
          />
          <CardContent className="p-5">
            <ArchiveTargets counts={counts} lastBackups={lastBackups} />
          </CardContent>
        </Card>

        <Card className="gap-0 py-0">
          <SectionHeader
            icon={History}
            title="Riwayat Arsip"
            description="Unduh file, import ulang ke database, atau hapus file dari server."
          />
          <CardContent className="p-0">
            <ArchiveHistory rows={history} />
          </CardContent>
        </Card>

        <Card className="gap-0 py-0">
          <SectionHeader
            icon={FileUp}
            title="Import dari File"
            description="Untuk arsip yang file-nya sudah dihapus dari server."
          />
          <CardContent className="p-5">
            <ArchiveUpload />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
