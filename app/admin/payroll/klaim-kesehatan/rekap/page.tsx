import Link from "next/link"
import { redirect } from "next/navigation"
import { FileSpreadsheet } from "lucide-react"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { currentPlafonYear, getHealthClaimSettings, getPlafonRecap } from "@/lib/health-claim"
import { formatRupiah, plafonPeriodLabel } from "@/lib/health-claim-labels"
import { Breadcrumb } from "@/components/breadcrumb"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

export default async function RekapPlafonPage({ searchParams }: { searchParams: Promise<{ tahun?: string; q?: string }> }) {
  const session = await auth()
  const user = session?.user
  const allowed =
    user?.role === "SUPER_ADMIN" || (user?.role === "HR_ADMIN" && user.menuAccess.includes("payroll.klaim-kesehatan"))
  if (!allowed) redirect("/admin/dashboard")

  const { plafonStartMonth } = await getHealthClaimSettings()
  const currentYear = currentPlafonYear(plafonStartMonth)
  const { tahun, q } = await searchParams
  const year = Number(tahun) >= 2000 && Number(tahun) <= currentYear + 1 ? Number(tahun) : currentYear
  const [recap, yearsRaw] = await Promise.all([
    getPlafonRecap(year),
    prisma.healthClaim.findMany({ select: { plafonYear: true }, distinct: ["plafonYear"] }),
  ])
  const years = [...new Set([currentYear, ...yearsRaw.map((y) => y.plafonYear)])].sort((a, b) => b - a)
  const query = (q ?? "").trim().toLowerCase()
  const rows = query
    ? recap.filter((r) => r.fullName.toLowerCase().includes(query) || r.employeeNumber.toLowerCase().includes(query))
    : recap

  const totals = {
    used: recap.reduce((s, r) => s + r.used, 0),
    inProgress: recap.reduce((s, r) => s + r.inProgress, 0),
    claims: recap.reduce((s, r) => s + r.claimCount, 0),
    unset: recap.filter((r) => r.plafon === null && r.isActive).length,
  }

  return (
    <div>
      <Breadcrumb
        items={[
          { label: "Dashboard", href: "/admin/dashboard" },
          { label: "Payroll" },
          { label: "Klaim Kesehatan", href: "/admin/payroll/klaim-kesehatan" },
          { label: "Rekap Plafon" },
        ]}
      />
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold sm:text-2xl">Rekap Plafon Klaim Kesehatan {plafonPeriodLabel(year, plafonStartMonth)}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Plafon, terpakai, sedang diproses, dan sisa per pegawai.</p>
        </div>
        <Button render={<a href={`/api/klaim-kesehatan/rekap?tahun=${year}`} />} nativeButton={false}>
          <FileSpreadsheet className="size-4" />
          Unduh Excel
        </Button>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Terpakai", value: formatRupiah(totals.used) },
          { label: "Sedang diproses", value: formatRupiah(totals.inProgress) },
          { label: "Jumlah klaim", value: String(totals.claims) },
          { label: "Pegawai tanpa plafon", value: String(totals.unset) },
        ].map((s) => (
          <Card key={s.label} className="py-0">
            <CardContent className="px-4 py-3.5">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="mt-1 text-xl font-semibold tabular-nums">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {years.map((y) => (
            <Link
              key={y}
              href={`/admin/payroll/klaim-kesehatan/rekap?tahun=${y}`}
              className={`rounded-full border px-3 py-1 text-xs font-medium ${
                y === year ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"
              }`}
            >
              {plafonPeriodLabel(y, plafonStartMonth)}
            </Link>
          ))}
        </div>
        <form className="flex gap-2">
          <input type="hidden" name="tahun" value={year} />
          <input
            name="q"
            defaultValue={q}
            placeholder="Cari nama atau NIP..."
            className="h-8 w-56 rounded-md border bg-transparent px-2.5 text-sm"
          />
          <Button size="sm" variant="outline" type="submit">
            Cari
          </Button>
        </form>
      </div>

      <Card className="py-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Pegawai</th>
                <th className="px-4 py-2.5 font-medium">Jabatan</th>
                <th className="px-4 py-2.5 text-right font-medium">Plafon</th>
                <th className="px-4 py-2.5 text-right font-medium">Terpakai</th>
                <th className="px-4 py-2.5 text-right font-medium">Diproses</th>
                <th className="px-4 py-2.5 text-right font-medium">Sisa</th>
                <th className="px-4 py-2.5 text-right font-medium">Klaim</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.employeeId} className="border-t">
                  <td className="px-4 py-2">
                    {r.fullName}
                    <span className="block text-xs text-muted-foreground">
                      {r.employeeNumber} · {r.employmentStatus}
                      {r.isActive ? "" : " · nonaktif"}
                    </span>
                  </td>
                  <td className="px-4 py-2">{r.position}</td>
                  <td className="px-4 py-2 text-right tabular-nums whitespace-nowrap">
                    {r.plafon === null ? <span className="text-xs text-amber-700 dark:text-amber-400">Belum diatur</span> : formatRupiah(r.plafon)}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums whitespace-nowrap">{formatRupiah(r.used)}</td>
                  <td className="px-4 py-2 text-right tabular-nums whitespace-nowrap">{formatRupiah(r.inProgress)}</td>
                  <td className="px-4 py-2 text-right font-medium tabular-nums whitespace-nowrap">
                    {r.remaining === null ? "-" : formatRupiah(r.remaining)}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">{r.claimCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
