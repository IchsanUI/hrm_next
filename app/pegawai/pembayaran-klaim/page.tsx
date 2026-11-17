import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { Banknote, FileSpreadsheet } from "lucide-react"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { isHealthClaimStaff } from "@/lib/health-claim"
import { formatRupiah } from "@/lib/health-claim-labels"
import { Breadcrumb } from "@/components/breadcrumb"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { MemoStatusBadge } from "@/components/health-claim-memo-views"

const TABS = [
  { key: "siap", label: "Siap Dibayar", statuses: ["DISETUJUI"] },
  { key: "lunas", label: "Sudah Dibayar", statuses: ["DIBAYAR"] },
  { key: "proses", label: "Masih Proses", statuses: ["MENUNGGU_PERSETUJUAN", "DIKEMBALIKAN"] },
] as const

// Menu Accounting: Nota Dinas final dilihat langsung di HRIS (tanpa cetakan
// dari petugas), lalu pembayarannya dicatat di sini.
export default async function PembayaranKlaimPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const session = await auth()
  const employeeId = session?.user.employeeId
  if (!employeeId) redirect("/login")
  if (!(await isHealthClaimStaff(employeeId, "ACCOUNTING"))) notFound()

  const { tab } = await searchParams
  const active = TABS.find((t) => t.key === tab) ?? TABS[0]
  const [memos, counts] = await Promise.all([
    prisma.healthClaimMemo.findMany({
      where: { status: { in: [...active.statuses] } },
      orderBy: { memoDate: active.key === "lunas" ? "desc" : "asc" },
      take: 200,
      include: {
        createdBy: { select: { fullName: true } },
        _count: { select: { items: true, payments: true } },
        payments: { select: { amount: true } },
      },
    }),
    prisma.healthClaimMemo.groupBy({ by: ["status"], _count: { _all: true } }),
  ])
  const countFor = (statuses: readonly string[]) =>
    counts.filter((c) => statuses.includes(c.status)).reduce((s, c) => s + c._count._all, 0)
  const year = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" }).slice(0, 4)

  return (
    <div>
      <Breadcrumb items={[{ label: "Dashboard", href: "/pegawai/dashboard" }, { label: "Pembayaran Klaim" }]} />
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Banknote className="size-5" />
          </span>
          <div>
            <h1 className="text-xl font-semibold sm:text-2xl">Pembayaran Klaim Kesehatan</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Nota Dinas yang sudah didisposisi Direksi, lengkap dengan rincian, bukti, dan rekening pegawai.
            </p>
          </div>
        </div>
        <Button variant="outline" render={<a href={`/api/klaim-kesehatan/rekap?tahun=${year}`} />} nativeButton={false}>
          <FileSpreadsheet className="size-4" />
          Rekap Plafon {year}
        </Button>
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {TABS.map((t) => {
          const n = countFor(t.statuses)
          return (
            <Link
              key={t.key}
              href={`/pegawai/pembayaran-klaim?tab=${t.key}`}
              className={`rounded-full border px-3 py-1 text-xs font-medium ${
                t.key === active.key ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"
              }`}
            >
              {t.label}
              {n > 0 ? ` (${n})` : ""}
            </Link>
          )
        })}
      </div>

      <Card className="py-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Nota Dinas</th>
                <th className="px-4 py-2.5 font-medium">Tanggal</th>
                <th className="px-4 py-2.5 text-right font-medium">Total</th>
                <th className="px-4 py-2.5 font-medium">Dibayar</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {memos.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                    Tidak ada Nota Dinas di sini.
                  </td>
                </tr>
              ) : (
                memos.map((m) => {
                  const paid = m.payments.reduce((s, p) => s + p.amount, 0)
                  const partial = m.status === "DISETUJUI" && m._count.payments > 0
                  return (
                    <tr key={m.id} className="border-t">
                      <td className="px-4 py-2.5">
                        <Link href={`/pegawai/pembayaran-klaim/${m.publicId}`} className="font-medium text-primary hover:underline">
                          {m.memoNumber}
                        </Link>
                        <span className="block text-xs text-muted-foreground">
                          {m._count.items} klaim · oleh {m.createdBy.fullName}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        {m.memoDate.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" })}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums whitespace-nowrap">{formatRupiah(m.totalAmount)}</td>
                      <td className="px-4 py-2.5 text-xs whitespace-nowrap">
                        {m._count.payments} dari {m._count.items} klaim
                        <span className="block text-muted-foreground tabular-nums">{formatRupiah(paid)}</span>
                      </td>
                      <td className="px-4 py-2.5">
                        {partial ? (
                          <span className="inline-flex rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                            Dibayar Sebagian
                          </span>
                        ) : (
                          <MemoStatusBadge status={m.status} />
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
