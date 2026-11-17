import Link from "next/link"
import { Download, FileText, Info } from "lucide-react"

import { prisma } from "@/lib/prisma"
import { isHealthClaimStaff } from "@/lib/health-claim"
import { getMemoHistory, renderMemoOpening } from "@/lib/health-claim-memo"
import {
  DISPOSITION_LABEL,
  MEMO_STATUS_CLASS,
  MEMO_STATUS_LABEL,
  MEMO_STEP_STATUS_LABEL,
  formatRupiah,
  type HealthClaimMemoStatusValue,
} from "@/lib/health-claim-labels"
import { cn } from "@/lib/utils"
import { Breadcrumb } from "@/components/breadcrumb"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { MemoApproverPanel, MemoItemActions, MemoPetugasPanel } from "@/components/health-claim-memo-actions"
import { HealthClaimPaymentPanel } from "@/components/health-claim-payment-panel"
import { MemoPdfPreviewButton } from "@/components/health-claim-memo-preview"

type Crumb = { label: string; href?: string }
type Viewer = { role: string; employeeId?: number | null }

export function MemoStatusBadge({ status }: { status: HealthClaimMemoStatusValue }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        MEMO_STATUS_CLASS[status],
      )}
    >
      {MEMO_STATUS_LABEL[status]}
    </span>
  )
}

function formatDate(d: Date) {
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" })
}
function formatDateTime(d: Date) {
  return d.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  })
}

// ── Daftar Nota Dinas ───────────────────────────────────────

export async function HealthClaimMemoList({
  basePath,
  breadcrumbItems,
  newHref,
}: {
  basePath: string
  breadcrumbItems: Crumb[]
  newHref?: string
}) {
  const memos = await prisma.healthClaimMemo.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      createdBy: { select: { fullName: true } },
      _count: { select: { items: true } },
      steps: {
        where: { status: "AKTIF" },
        select: { label: true, approverEmployee: { select: { fullName: true } } },
      },
    },
  })

  return (
    <div>
      <Breadcrumb items={breadcrumbItems} />
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold sm:text-2xl">Nota Dinas Klaim Kesehatan</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Pengajuan dana penggantian biaya pengobatan ke Direksi, beserta status persetujuannya.
          </p>
        </div>
        {newHref ? (
          <Button render={<Link href={newHref} />} nativeButton={false}>
            <FileText className="size-4" />
            Buat Nota Dinas
          </Button>
        ) : null}
      </div>
      <Card className="py-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Nomor</th>
                <th className="px-4 py-2.5 font-medium">Tanggal</th>
                <th className="px-4 py-2.5 text-right font-medium">Klaim</th>
                <th className="px-4 py-2.5 text-right font-medium">Total</th>
                <th className="px-4 py-2.5 font-medium">Posisi</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {memos.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                    Belum ada Nota Dinas.
                  </td>
                </tr>
              ) : (
                memos.map((m) => (
                  <tr key={m.id} className="border-t">
                    <td className="px-4 py-2.5 font-medium whitespace-nowrap">
                      <Link href={`${basePath}/${m.publicId}`} className="text-primary hover:underline">
                        {m.memoNumber}
                      </Link>
                      <span className="block text-xs font-normal text-muted-foreground">
                        oleh {m.createdBy.fullName}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">{formatDate(m.memoDate)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{m._count.items}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums whitespace-nowrap">
                      {formatRupiah(m.totalAmount)}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">
                      {m.steps[0]
                        ? `${m.steps[0].label}${m.steps[0].approverEmployee ? ` (${m.steps[0].approverEmployee.fullName})` : ""}`
                        : "-"}
                    </td>
                    <td className="px-4 py-2.5">
                      <MemoStatusBadge status={m.status} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

// ── Detail Nota Dinas ───────────────────────────────────────

export async function HealthClaimMemoDetail({
  publicId,
  breadcrumbItems,
  viewer,
  claimHref,
  showPayments = true,
}: {
  publicId: string
  breadcrumbItems: Crumb[]
  viewer: Viewer
  claimHref?: (claimPublicId: string) => string
  // Bagian pembayaran hanya untuk petugas, Accounting, dan admin — penyetuju
  // & Direktur cukup melihat isi, alur, dan riwayat Nota Dinas.
  showPayments?: boolean
}) {
  const memo = await prisma.healthClaimMemo.findUnique({
    where: { publicId },
    include: {
      createdBy: { select: { fullName: true } },
      items: {
        orderBy: { order: "asc" },
        include: {
          claim: {
            select: {
              publicId: true,
              claimNumber: true,
              patientName: true,
              patientType: true,
              employee: {
                select: {
                  fullName: true,
                  employeeNumber: true,
                  bankName: true,
                  bankAccountNumber: true,
                  bankAccountHolder: true,
                },
              },
              payment: true,
            },
          },
        },
      },
      proofs: { orderBy: { createdAt: "asc" } },
      steps: {
        orderBy: [{ round: "asc" }, { order: "asc" }],
        include: { approverEmployee: { select: { fullName: true } } },
      },
    },
  })
  if (!memo) return null

  const activeStep = memo.steps.find((s) => s.round === memo.round && s.status === "AKTIF") ?? null
  const isActiveApprover =
    memo.status === "MENUNGGU_PERSETUJUAN" &&
    !!viewer.employeeId &&
    activeStep?.approverEmployeeId === viewer.employeeId
  const isPetugas = viewer.role === "SUPER_ADMIN" || (await isHealthClaimStaff(viewer.employeeId ?? null, "PETUGAS"))
  const isAccounting =
    viewer.role === "SUPER_ADMIN" || (await isHealthClaimStaff(viewer.employeeId ?? null, "ACCOUNTING"))
  const isApproved = memo.status === "DISETUJUI" || memo.status === "DIBAYAR"
  const dispositionStep = memo.steps.find(
    (s) => s.round === memo.round && s.type === "DISPOSISI_DIREKTUR" && s.status === "DISETUJUI",
  )
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" })
  const actedThisRound = memo.steps.some(
    (s) => s.round === memo.round && ["DISETUJUI", "DIKEMBALIKAN", "DITOLAK"].includes(s.status),
  )
  const canResubmit = isPetugas && memo.status === "DIKEMBALIKAN"
  const canCancel =
    isPetugas && (memo.status === "DIKEMBALIKAN" || (memo.status === "MENUNGGU_PERSETUJUAN" && !actedThisRound))
  const lastReturn = [...memo.steps].reverse().find((s) => s.status === "DIKEMBALIKAN")
  const rejected = memo.steps.find((s) => s.status === "DITOLAK")
  const rounds = [...new Set(memo.steps.map((s) => s.round))].sort((a, b) => b - a)
  const pdfHref = `/api/klaim-kesehatan/nota-dinas/${memo.publicId}/pdf`
  const history = await getMemoHistory(memo.id)

  return (
    <div>
      <Breadcrumb items={[...breadcrumbItems, { label: memo.memoNumber }]} />
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold sm:text-2xl">Nota Dinas {memo.memoNumber}</h1>
            <MemoStatusBadge status={memo.status} />
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {formatDate(memo.memoDate)} · dibuat oleh {memo.createdBy.fullName} · {memo.items.length} klaim ·{" "}
            {formatRupiah(memo.totalAmount)}
            {memo.letterNumber ? ` · No. ${memo.letterNumber}` : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <MemoPdfPreviewButton pdfHref={pdfHref} memoNumber={memo.memoNumber} />
          <Button variant="outline" render={<a href={`${pdfHref}?unduh=1`} />} nativeButton={false}>
            <Download className="size-4" />
            Unduh
          </Button>
        </div>
      </div>

      {memo.status === "DIKEMBALIKAN" && lastReturn ? (
        <div className="mb-6 rounded-lg border border-orange-300 bg-orange-50 px-4 py-3 text-sm text-orange-900 dark:border-orange-800 dark:bg-orange-950/40 dark:text-orange-200">
          <span className="font-medium">
            Dikembalikan oleh {lastReturn.actorName} ({lastReturn.label})
            {lastReturn.decision ? ` — ${DISPOSITION_LABEL[lastReturn.decision]}` : ""}:
          </span>{" "}
          {lastReturn.note}
        </div>
      ) : null}
      {memo.status === "DITOLAK" && rejected ? (
        <div className="mb-6 rounded-lg border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-900 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200">
          <span className="font-medium">Tidak disetujui oleh {rejected.actorName}:</span> {rejected.note}
        </div>
      ) : null}
      {isApproved && dispositionStep ? (
        <div className="mb-6 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
          <span className="font-medium">
            Disposisi {dispositionStep.actorName}:{" "}
            {dispositionStep.decision ? DISPOSITION_LABEL[dispositionStep.decision] : "Disetujui"}
          </span>
          {dispositionStep.note ? ` — ${dispositionStep.note}` : ""}
        </div>
      ) : null}
      {memo.forcedReason ? (
        <div className="mb-6 flex items-start gap-2 rounded-lg border bg-muted/40 px-4 py-3 text-sm">
          <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          Dibuat dengan klaim kurang dari minimal: {memo.forcedReason}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="grid content-start gap-6">
          {isActiveApprover && activeStep ? (
            <MemoApproverPanel
              publicId={memo.publicId}
              stepType={activeStep.type}
              stepLabel={activeStep.label}
              total={memo.totalAmount}
            />
          ) : null}

          <Card>
            <CardHeader className="border-b">
              <CardTitle>Isi Nota Dinas</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 pt-2 text-sm">
              <dl className="grid gap-1 sm:grid-cols-[90px_1fr]">
                <dt className="text-muted-foreground">Kepada</dt>
                <dd>{memo.toText}</dd>
                <dt className="text-muted-foreground">Dari</dt>
                <dd>{memo.fromText}</dd>
                <dt className="text-muted-foreground">Perihal</dt>
                <dd>{memo.subject}</dd>
              </dl>
              <p className="leading-relaxed">{renderMemoOpening(memo.opening, memo.totalAmount)}</p>
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">No</th>
                      <th className="px-3 py-2 font-medium">Pegawai</th>
                      <th className="px-3 py-2 text-right font-medium">Saldo Awal</th>
                      <th className="px-3 py-2 font-medium">Pasien</th>
                      <th className="px-3 py-2 text-right font-medium">Jumlah Klaim</th>
                      <th className="px-3 py-2 font-medium">Keterangan</th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {memo.items.map((item, i) => (
                      <tr key={item.id} className="border-t align-top">
                        <td className="px-3 py-2 tabular-nums">{i + 1}</td>
                        <td className="px-3 py-2">
                          {item.claim.employee.fullName}
                          <span className="block text-xs text-muted-foreground">
                            {claimHref ? (
                              <Link href={claimHref(item.claim.publicId)} className="hover:underline">
                                {item.claim.claimNumber}
                              </Link>
                            ) : (
                              item.claim.claimNumber
                            )}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                          {formatRupiah(item.balanceBefore)}
                        </td>
                        <td className="px-3 py-2">
                          {item.claim.patientName}
                          {item.claim.patientType === "CHILD"
                            ? " (Anak)"
                            : item.claim.patientType === "SPOUSE"
                              ? " (Pasangan)"
                              : ""}
                        </td>
                        <td className="px-3 py-2 text-right font-medium tabular-nums whitespace-nowrap">
                          {formatRupiah(item.amount)}
                        </td>
                        <td className="px-3 py-2">{item.note}</td>
                        <td className="px-2 py-1.5">
                          <MemoItemActions
                            memoPublicId={memo.publicId}
                            claimPublicId={item.claim.publicId}
                            claimNumber={item.claim.claimNumber}
                            amount={item.amount}
                            canAdjust={isActiveApprover && !!activeStep?.canAdjust}
                            canRemove={(isActiveApprover && !!activeStep?.canAdjust) || canResubmit}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t font-semibold">
                      <td className="px-3 py-2" colSpan={4}>
                        Total
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                        {formatRupiah(memo.totalAmount)}
                      </td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                </table>
              </div>
              {memo.closing ? <p className="leading-relaxed whitespace-pre-line">{memo.closing}</p> : null}
            </CardContent>
          </Card>

          {isApproved && showPayments ? (
            <HealthClaimPaymentPanel
              memoPublicId={memo.publicId}
              canRecord={isAccounting && memo.status === "DISETUJUI"}
              canManageProofs={isAccounting}
              isSuperAdmin={viewer.role === "SUPER_ADMIN"}
              today={today}
              rows={memo.items.map((i) => ({
                claimPublicId: i.claim.publicId,
                claimNumber: i.claim.claimNumber,
                employeeName: i.claim.employee.fullName,
                employeeNumber: i.claim.employee.employeeNumber,
                patient:
                  i.claim.patientType === "CHILD"
                    ? `${i.claim.patientName} (Anak)`
                    : i.claim.patientType === "SPOUSE"
                      ? `${i.claim.patientName} (Pasangan)`
                      : i.claim.patientName,
                amount: i.amount,
                bank: {
                  bankName: i.claim.employee.bankName ?? "",
                  accountNumber: i.claim.employee.bankAccountNumber ?? "",
                  holder: i.claim.employee.bankAccountHolder ?? "",
                },
                payment: i.claim.payment
                  ? {
                      method: i.claim.payment.method,
                      paidDate: formatDate(i.claim.payment.paidDate),
                      reference: i.claim.payment.reference,
                      bankName: i.claim.payment.bankName,
                      accountNumber: i.claim.payment.bankAccountNumber,
                      recordedByName: i.claim.payment.recordedByName,
                    }
                  : null,
              }))}
              proofs={memo.proofs.map((p) => ({
                publicId: p.publicId,
                originalName: p.originalName,
                uploadedByName: p.uploadedByName,
                createdAt: formatDateTime(p.createdAt),
              }))}
            />
          ) : null}

          {canResubmit || canCancel ? (
            <MemoPetugasPanel
              publicId={memo.publicId}
              memoNumber={memo.memoNumber}
              canResubmit={canResubmit}
              canCancel={canCancel}
              opening={memo.opening}
              closing={memo.closing}
              rows={memo.items.map((i) => ({
                claimPublicId: i.claim.publicId,
                label: `${i.claim.employee.fullName} · ${i.claim.claimNumber}`,
                note: i.note,
              }))}
            />
          ) : null}
        </div>

        <div className="grid min-w-0 content-start gap-6">
          <Card>
            <CardHeader className="border-b">
              <CardTitle>Alur Persetujuan</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-5 pt-2">
              {rounds.map((round) => (
                <div key={round} className="grid gap-2">
                  {rounds.length > 1 ? (
                    <p className="text-xs font-medium text-muted-foreground uppercase">
                      Pengajuan ke-{round}
                      {round === memo.round ? " (terbaru)" : ""}
                    </p>
                  ) : null}
                  <ol className="grid gap-3">
                    {memo.steps
                      .filter((s) => s.round === round)
                      .map((s) => (
                        <li key={s.id} className="flex gap-3 text-sm">
                          <span
                            className={cn(
                              "mt-1 size-2.5 shrink-0 rounded-full",
                              s.status === "DISETUJUI" && "bg-emerald-500",
                              s.status === "AKTIF" && "bg-amber-500 ring-4 ring-amber-500/20",
                              (s.status === "DIKEMBALIKAN" || s.status === "DITOLAK") && "bg-rose-500",
                              (s.status === "MENUNGGU" || s.status === "DILEWATI" || s.status === "DIBATALKAN") &&
                                "bg-muted-foreground/30",
                            )}
                          />
                          <div className="min-w-0">
                            <p className="font-medium">{s.label}</p>
                            <p className="text-xs text-muted-foreground">
                              {s.approverEmployee?.fullName ?? (s.status === "DILEWATI" ? "Tidak ada penyetuju" : "-")}{" "}
                              · {s.decision ? DISPOSITION_LABEL[s.decision] : MEMO_STEP_STATUS_LABEL[s.status]}
                              {s.actedAt ? ` · ${formatDateTime(s.actedAt)}` : ""}
                            </p>
                            {s.note ? <p className="mt-1 text-xs">{s.note}</p> : null}
                          </div>
                        </li>
                      ))}
                  </ol>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b">
              <CardTitle>Riwayat</CardTitle>
            </CardHeader>
            <CardContent className="pt-2">
              <ol className="relative grid gap-4 border-l pl-4">
                {history.map((h, i) => (
                  <li key={i} className="text-sm">
                    <span
                      className={cn(
                        "absolute -left-[5px] mt-1.5 size-2.5 rounded-full",
                        h.tone === "success" && "bg-emerald-500",
                        h.tone === "warning" && "bg-amber-500",
                        h.tone === "danger" && "bg-rose-500",
                        h.tone === "neutral" && "bg-primary",
                      )}
                    />
                    <p className="font-medium">{h.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {h.actor} · {formatDateTime(h.at)}
                    </p>
                    {h.detail ? <p className="mt-1 rounded-md bg-muted/60 px-2 py-1 text-xs">{h.detail}</p> : null}
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
