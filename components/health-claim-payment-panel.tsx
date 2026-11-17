"use client"

import { useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Banknote, FileText, Loader2, Trash2, Undo2, Upload } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { formatRupiah } from "@/lib/health-claim-labels"
import { compressImage } from "@/lib/compress-image"
import {
  cancelPaymentAction,
  deletePaymentProofAction,
  recordPaymentsAction,
  uploadPaymentProofAction,
  type PaymentActionResult,
} from "@/server/actions/health-claim-payment"

export type PaymentRow = {
  claimPublicId: string
  claimNumber: string
  employeeName: string
  employeeNumber: string
  patient: string
  amount: number
  bank: { bankName: string; accountNumber: string; holder: string }
  payment: {
    method: "TUNAI" | "TRANSFER"
    paidDate: string
    reference: string | null
    bankName: string | null
    accountNumber: string | null
    recordedByName: string
  } | null
}
export type ProofRow = { publicId: string; originalName: string; uploadedByName: string; createdAt: string }

type BankInput = { bankName: string; accountNumber: string; holder: string; save: boolean }

export function HealthClaimPaymentPanel({
  memoPublicId,
  rows,
  proofs,
  canRecord,
  canManageProofs,
  isSuperAdmin,
  today,
}: {
  memoPublicId: string
  rows: PaymentRow[]
  proofs: ProofRow[]
  canRecord: boolean
  // Accounting (dan Super Admin) boleh mengunggah/menghapus bukti pembayaran.
  canManageProofs: boolean
  isSuperAdmin: boolean
  today: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const unpaid = rows.filter((r) => !r.payment)
  const [selected, setSelected] = useState(() => new Set(unpaid.map((r) => r.claimPublicId)))
  const [paidDate, setPaidDate] = useState(today)
  const [journalNumber, setJournalNumber] = useState("")
  const [bank, setBank] = useState<Record<string, BankInput>>(() =>
    Object.fromEntries(
      rows.map((r) => [
        r.claimPublicId,
        {
          bankName: r.bank.bankName,
          accountNumber: r.bank.accountNumber,
          holder: r.bank.holder || r.employeeName,
          save: !r.bank.accountNumber,
        },
      ]),
    ),
  )
  const [cancelTarget, setCancelTarget] = useState<PaymentRow | null>(null)
  const [cancelReason, setCancelReason] = useState("")
  const fileRef = useRef<HTMLInputElement>(null)

  const chosen = unpaid.filter((r) => selected.has(r.claimPublicId))
  const chosenTotal = chosen.reduce((s, r) => s + r.amount, 0)
  const paidTotal = rows.filter((r) => r.payment).reduce((s, r) => s + r.amount, 0)
  const total = rows.reduce((s, r) => s + r.amount, 0)

  const run = (fn: () => Promise<PaymentActionResult>, after?: () => void) =>
    startTransition(async () => {
      const result = await fn()
      if ("error" in result) toast.error(result.error)
      else {
        toast.success(result.success)
        after?.()
        router.refresh()
      }
    })

  function record() {
    run(() =>
      recordPaymentsAction(
        memoPublicId,
        chosen.map((r) => ({
          claimPublicId: r.claimPublicId,
          paidDate,
          journalNumber,
          bankName: bank[r.claimPublicId].bankName,
          bankAccountNumber: bank[r.claimPublicId].accountNumber,
          bankAccountHolder: bank[r.claimPublicId].holder,
          saveToEmployee: bank[r.claimPublicId].save,
        })),
      ),
    )
  }

  async function upload(files: File[]) {
    const fd = new FormData()
    for (const f of files) {
      fd.append(
        "files",
        f.type.startsWith("image/") ? await compressImage(f, { maxDimension: 2200, quality: 0.82 }) : f,
      )
    }
    run(() => uploadPaymentProofAction(memoPublicId, fd))
  }

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader className="border-b">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Pembayaran per Pegawai</CardTitle>
              <CardDescription>
                Sudah ditransfer {formatRupiah(paidTotal)} dari {formatRupiah(total)} ({rows.length - unpaid.length}{" "}
                dari {rows.length} klaim).
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-2">
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="w-10 min-w-10 px-3 py-2">
                    {canRecord && unpaid.length > 0 ? (
                      <Checkbox
                        aria-label="Pilih semua yang belum dibayar"
                        checked={chosen.length === unpaid.length}
                        onCheckedChange={(v) =>
                          setSelected(v === true ? new Set(unpaid.map((r) => r.claimPublicId)) : new Set())
                        }
                      />
                    ) : null}
                  </th>
                  <th className="px-3 py-2 font-medium">Pegawai</th>
                  <th className="px-3 py-2 font-medium">Pasien</th>
                  <th className="px-3 py-2 text-right font-medium">Nominal</th>
                  <th className="px-3 py-2 font-medium">Rekening</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.claimPublicId} className="border-t align-top">
                    <td className="w-10 min-w-10 px-3 py-2">
                      {canRecord && !r.payment ? (
                        <Checkbox
                          aria-label={`Pilih ${r.claimNumber}`}
                          checked={selected.has(r.claimPublicId)}
                          onCheckedChange={(v) =>
                            setSelected((prev) => {
                              const next = new Set(prev)
                              if (v === true) next.add(r.claimPublicId)
                              else next.delete(r.claimPublicId)
                              return next
                            })
                          }
                        />
                      ) : null}
                    </td>
                    <td className="px-3 py-2">
                      {r.employeeName}
                      <span className="block text-xs text-muted-foreground">
                        {r.employeeNumber} · {r.claimNumber}
                      </span>
                    </td>
                    <td className="px-3 py-2">{r.patient}</td>
                    <td className="px-3 py-2 text-right font-medium tabular-nums whitespace-nowrap">
                      {formatRupiah(r.amount)}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {r.bank.accountNumber ? (
                        <>
                          {r.bank.bankName} {r.bank.accountNumber}
                          <span className="block text-muted-foreground">a.n. {r.bank.holder || r.employeeName}</span>
                        </>
                      ) : (
                        <span className="text-muted-foreground">Belum diisi</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {r.payment ? (
                        <div className="flex items-start justify-between gap-2">
                          <span>
                            <span className="font-medium text-emerald-700 dark:text-emerald-400">
                              {r.payment.method === "TRANSFER" ? "Ditransfer" : "Dibayar tunai"}
                            </span>
                            <span className="block text-muted-foreground">
                              {r.payment.paidDate} · {r.payment.recordedByName}
                            </span>
                            {r.payment.reference ? (
                              <span className="block text-muted-foreground">Jurnal CBS: {r.payment.reference}</span>
                            ) : null}
                          </span>
                          {isSuperAdmin ? (
                            <Button
                              size="icon-sm"
                              variant="ghost"
                              aria-label={`Batalkan pembayaran ${r.claimNumber}`}
                              onClick={() => setCancelTarget(r)}
                            >
                              <Undo2 className="size-4" />
                            </Button>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-amber-700 dark:text-amber-400">Belum ditransfer</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {canRecord && unpaid.length > 0 ? (
        <Card className="border-primary/40">
          <CardHeader className="border-b">
            <CardTitle>Catat Transfer</CardTitle>
            <CardDescription>
              Centang pegawai yang sudah ditransfer, isi Nomor Jurnal di CBS, dan pastikan rekening tujuannya benar.
              Pegawai yang belum ditransfer bisa dicatat belakangan.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 pt-2">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="paidDate">Tanggal transfer</Label>
                <Input
                  id="paidDate"
                  type="date"
                  max={today}
                  value={paidDate}
                  onChange={(e) => setPaidDate(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="journal">
                  Nomor Jurnal CBS <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="journal"
                  placeholder="Nomor jurnal transaksi di CBS"
                  value={journalNumber}
                  onChange={(e) => setJournalNumber(e.target.value)}
                />
              </div>
            </div>

            {chosen.length > 0 ? (
              <div className="grid gap-3">
                <Label>Rekening tujuan</Label>
                {chosen.map((r) => {
                  const b = bank[r.claimPublicId]
                  const set = (patch: Partial<BankInput>) =>
                    setBank((prev) => ({ ...prev, [r.claimPublicId]: { ...prev[r.claimPublicId], ...patch } }))
                  return (
                    <div key={r.claimPublicId} className="grid gap-2 rounded-md border p-3">
                      <p className="text-sm font-medium">
                        {r.employeeName} · {formatRupiah(r.amount)}
                      </p>
                      <div className="grid gap-2 sm:grid-cols-3">
                        <Input
                          placeholder="Nama bank"
                          value={b.bankName}
                          onChange={(e) => set({ bankName: e.target.value })}
                        />
                        <Input
                          placeholder="Nomor rekening"
                          inputMode="numeric"
                          value={b.accountNumber}
                          onChange={(e) => set({ accountNumber: e.target.value })}
                        />
                        <Input
                          placeholder="Atas nama"
                          value={b.holder}
                          onChange={(e) => set({ holder: e.target.value })}
                        />
                      </div>
                      <label className="flex items-center gap-2 text-xs">
                        <Checkbox checked={b.save} onCheckedChange={(v) => set({ save: v === true })} />
                        Simpan rekening ini ke data pegawai
                      </label>
                    </div>
                  )
                })}
              </div>
            ) : null}

            <div>
              <Button
                disabled={
                  isPending ||
                  chosen.length === 0 ||
                  !paidDate ||
                  !journalNumber.trim() ||
                  chosen.some(
                    (r) => !bank[r.claimPublicId].bankName.trim() || !bank[r.claimPublicId].accountNumber.trim(),
                  )
                }
                onClick={record}
              >
                {isPending ? <Loader2 className="size-4 animate-spin" /> : <Banknote className="size-4" />}
                Catat Transfer {chosen.length} klaim · {formatRupiah(chosenTotal)}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Bukti Pembayaran</CardTitle>
          <CardDescription>Bukti transfer atau cetakan jurnal dari CBS.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 pt-2">
          {proofs.length === 0 ? <p className="text-sm text-muted-foreground">Belum ada bukti.</p> : null}
          {proofs.map((p) => (
            <div key={p.publicId} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
              <FileText className="size-4 shrink-0 text-muted-foreground" />
              <a
                href={`/api/klaim-kesehatan/bukti-bayar/${p.publicId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="min-w-0 flex-1 truncate hover:underline"
              >
                {p.originalName}
              </a>
              <span className="text-xs text-muted-foreground">
                {p.uploadedByName} · {p.createdAt}
              </span>
              {canManageProofs ? (
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`Hapus ${p.originalName}`}
                  disabled={isPending}
                  onClick={() => {
                    if (window.confirm(`Hapus bukti "${p.originalName}"?`))
                      run(() => deletePaymentProofAction(p.publicId))
                  }}
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              ) : null}
            </div>
          ))}
          {canManageProofs ? (
            <>
              <input
                ref={fileRef}
                type="file"
                multiple
                accept="application/pdf,image/jpeg,image/png"
                className="hidden"
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? [])
                  e.target.value = ""
                  if (files.length) void upload(files)
                }}
              />
              <Button variant="outline" className="w-fit" disabled={isPending} onClick={() => fileRef.current?.click()}>
                <Upload className="size-4" />
                Unggah bukti
              </Button>
            </>
          ) : null}
        </CardContent>
      </Card>

      <Dialog open={cancelTarget !== null} onOpenChange={(open) => !open && !isPending && setCancelTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Batalkan catatan pembayaran {cancelTarget?.claimNumber}?</DialogTitle>
            <DialogDescription>
              Gunakan hanya bila pembayaran salah dicatat. Klaim kembali berstatus Disetujui (belum dibayar).
            </DialogDescription>
          </DialogHeader>
          <Textarea
            rows={3}
            placeholder="Alasan"
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" disabled={isPending} onClick={() => setCancelTarget(null)}>
              Tidak
            </Button>
            <Button
              variant="destructive"
              disabled={isPending || cancelReason.trim().length < 5}
              onClick={() =>
                cancelTarget &&
                run(
                  () => cancelPaymentAction(cancelTarget.claimPublicId, cancelReason),
                  () => {
                    setCancelTarget(null)
                    setCancelReason("")
                  },
                )
              }
            >
              Batalkan Pembayaran
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
