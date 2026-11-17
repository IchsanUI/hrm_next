import { notFound, redirect } from "next/navigation"
import { BadgeCheck, ShieldAlert } from "lucide-react"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { DISPOSITION_LABEL, MEMO_STATUS_LABEL, formatRupiah } from "@/lib/health-claim-labels"
import { Card, CardContent } from "@/components/ui/card"

// Tujuan QR di PDF Nota Dinas final: memastikan cetakan yang beredar memang
// dikeluarkan HRIS dan isinya (total, jumlah klaim, persetujuan) cocok.
// Sengaja hanya ringkasan — rincian per pegawai tidak ditampilkan di sini.
export default async function VerifikasiNotaDinasPage({ params }: { params: Promise<{ publicId: string }> }) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const { publicId } = await params
  const memo = await prisma.healthClaimMemo.findUnique({
    where: { publicId },
    include: {
      _count: { select: { items: true } },
      steps: { orderBy: { order: "asc" } },
    },
  })
  if (!memo) notFound()

  const valid = memo.status === "DISETUJUI" || memo.status === "DIBAYAR"
  const steps = memo.steps.filter((s) => s.round === memo.round && s.status === "DISETUJUI")
  const date = (d: Date) => d.toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" })

  return (
    <div className="mx-auto max-w-lg">
      <Card>
        <CardContent className="grid gap-4">
          <div className="flex items-center gap-3">
            {valid ? (
              <BadgeCheck className="size-10 shrink-0 text-emerald-600" />
            ) : (
              <ShieldAlert className="size-10 shrink-0 text-amber-600" />
            )}
            <div>
              <p className="text-lg font-semibold">{valid ? "Nota Dinas sah" : "Nota Dinas belum final"}</p>
              <p className="text-sm text-muted-foreground">
                {valid
                  ? "Dokumen ini tercatat di HRIS Bank Gresik dan sudah disetujui Direksi."
                  : `Status saat ini: ${MEMO_STATUS_LABEL[memo.status]}. Cetakan dengan QR seharusnya hanya berasal dari Nota Dinas final.`}
              </p>
            </div>
          </div>
          <dl className="grid grid-cols-[130px_1fr] gap-y-1.5 text-sm">
            <dt className="text-muted-foreground">Nomor</dt>
            <dd className="font-medium">{memo.memoNumber}{memo.letterNumber ? ` · ${memo.letterNumber}` : ""}</dd>
            <dt className="text-muted-foreground">Tanggal</dt>
            <dd>{date(memo.memoDate)}</dd>
            <dt className="text-muted-foreground">Perihal</dt>
            <dd>{memo.subject}</dd>
            <dt className="text-muted-foreground">Jumlah klaim</dt>
            <dd>{memo._count.items}</dd>
            <dt className="text-muted-foreground">Total</dt>
            <dd className="font-semibold tabular-nums">{formatRupiah(memo.totalAmount)}</dd>
            <dt className="text-muted-foreground">Status</dt>
            <dd>{MEMO_STATUS_LABEL[memo.status]}</dd>
          </dl>
          {steps.length > 0 ? (
            <div className="border-t pt-3 text-sm">
              <p className="mb-1.5 font-medium">Persetujuan</p>
              <ul className="grid gap-1">
                {steps.map((s) => (
                  <li key={s.id} className="text-muted-foreground">
                    <span className="text-foreground">{s.label}</span> — {s.actorName}
                    {s.decision ? ` (${DISPOSITION_LABEL[s.decision]})` : ""}
                    {s.actedAt ? `, ${s.actedAt.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Jakarta" })}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
