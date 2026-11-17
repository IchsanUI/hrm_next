"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle, Check, ClipboardCheck, Loader2, RotateCcw, X } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
import {
  confirmHealthClaimAction,
  rejectHealthClaimAction,
  requestHealthClaimRevisionAction,
  type ReviewResult,
} from "@/server/actions/health-claim-review"
import { cn } from "@/lib/utils"

export type ReviewItem = { id: number; description: string; amount: number }

function parseAmount(raw: string) {
  const digits = raw.replace(/\D/g, "")
  return digits ? Number(digits) : 0
}

function AmountInput({
  id,
  value,
  onChange,
  invalid,
  changed,
  label,
}: {
  id: string
  value: string
  onChange: (v: string) => void
  invalid: boolean
  changed: boolean
  label: string
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">Rp</span>
      <Input
        id={id}
        inputMode="numeric"
        aria-label={label}
        aria-invalid={invalid}
        className={cn(
          "pl-9 text-right font-semibold tabular-nums",
          invalid && "border-destructive",
          changed && !invalid && "border-amber-500"
        )}
        value={value}
        onChange={(e) => {
          const n = parseAmount(e.target.value)
          onChange(n ? n.toLocaleString("id-ID") : "0")
        }}
      />
    </div>
  )
}

// Panel pemeriksaan klaim untuk petugas: ringkasan nominal, penyesuaian
// (wajib beralasan), lalu Konfirmasi / Minta Revisi / Tolak.
export function HealthClaimReviewPanel({
  publicId,
  claimNumber,
  items,
  bpjsCovered,
  requestedAmount,
  remainingPlafon,
}: {
  publicId: string
  claimNumber: string
  items: ReviewItem[]
  bpjsCovered: number
  requestedAmount: number
  remainingPlafon: number
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [values, setValues] = useState<Record<number, string>>(() =>
    Object.fromEntries(items.map((i) => [i.id, i.amount.toLocaleString("id-ID")]))
  )
  const [notes, setNotes] = useState<Record<number, string>>({})
  const [note, setNote] = useState("")
  const [dialog, setDialog] = useState<"REVISI" | "TOLAK" | null>(null)
  const [dialogNote, setDialogNote] = useState("")

  const approvedOf = (i: ReviewItem) => parseAmount(values[i.id] ?? "")
  const adjustedTotal = items.reduce((s, i) => s + approvedOf(i), 0)
  const afterBpjs = Math.max(0, adjustedTotal - bpjsCovered)
  const payable = Math.min(afterBpjs, remainingPlafon)
  const capped = payable < afterBpjs
  const invalid = items.find((i) => approvedOf(i) > i.amount)
  const missingNote = items.find((i) => approvedOf(i) !== i.amount && !notes[i.id]?.trim())
  const single = items.length === 1

  const run = (fn: () => Promise<ReviewResult>, after?: () => void) =>
    startTransition(async () => {
      const result = await fn()
      if ("error" in result) toast.error(result.error)
      else {
        toast.success(result.success)
        after?.()
        router.refresh()
      }
    })

  const summary = [
    { label: "Diajukan pegawai", value: formatRupiah(requestedAmount), hint: null },
    { label: "Sisa plafon", value: formatRupiah(remainingPlafon), hint: "untuk klaim ini" },
    { label: "Nominal disetujui", value: formatRupiah(payable), hint: capped ? "dibatasi sisa plafon" : null, strong: true },
  ]

  return (
    <Card className="border-primary/40">
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          <ClipboardCheck className="size-4" />
          Pemeriksaan Petugas
        </CardTitle>
        <CardDescription>
          Periksa bukti, lalu sesuaikan nominal bila ada biaya yang tidak bisa diklaim. Alasan penyesuaian akan terlihat oleh
          pegawai.
        </CardDescription>
      </CardHeader>

      <CardContent className="grid gap-6 pt-2">
        {/* Ringkasan */}
        <dl className="grid gap-3 sm:grid-cols-3">
          {summary.map((s) => (
            <div
              key={s.label}
              className={cn("rounded-lg border px-4 py-3", s.strong && "border-primary/50 bg-primary/5")}
            >
              <dt className="text-xs text-muted-foreground">{s.label}</dt>
              <dd className={cn("mt-1 tabular-nums", s.strong ? "text-xl font-semibold" : "text-lg font-medium")}>{s.value}</dd>
              {s.hint ? <dd className="text-xs text-muted-foreground">{s.hint}</dd> : null}
            </div>
          ))}
        </dl>

        {/* Penyesuaian nominal */}
        <section className="grid gap-3">
          <div>
            <p className="text-sm font-medium">Penyesuaian nominal</p>
            <p className="text-xs text-muted-foreground">Biarkan sama bila seluruh biaya bisa diklaim.</p>
          </div>

          {single ? (
            (() => {
              const item = items[0]
              const approved = approvedOf(item)
              const changed = approved !== item.amount
              return (
                <div className="grid gap-4 rounded-lg border p-4 sm:grid-cols-2">
                  <div className="grid content-start gap-1.5">
                    <Label htmlFor={`approved-${item.id}`}>Nominal disetujui</Label>
                    <AmountInput
                      id={`approved-${item.id}`}
                      label={`Nominal disetujui ${item.description}`}
                      value={values[item.id] ?? ""}
                      onChange={(v) => setValues((prev) => ({ ...prev, [item.id]: v }))}
                      invalid={approved > item.amount}
                      changed={changed}
                    />
                    <p className="text-xs text-muted-foreground">
                      {item.description} · diajukan {formatRupiah(item.amount)}
                    </p>
                  </div>
                  <div className="grid content-start gap-1.5">
                    <Label htmlFor={`reason-${item.id}`} className={cn(!changed && "text-muted-foreground")}>
                      Alasan penyesuaian {changed ? <span className="text-destructive">*</span> : null}
                    </Label>
                    <Textarea
                      id={`reason-${item.id}`}
                      rows={2}
                      disabled={!changed}
                      placeholder={changed ? "mis. Sebagian biaya pada nota tidak termasuk tanggungan" : "Diisi bila nominal diubah"}
                      value={notes[item.id] ?? ""}
                      onChange={(e) => setNotes((prev) => ({ ...prev, [item.id]: e.target.value }))}
                    />
                  </div>
                </div>
              )
            })()
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Uraian</th>
                    <th className="px-3 py-2 text-right font-medium">Diajukan</th>
                    <th className="w-44 px-3 py-2 text-right font-medium">Disetujui</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const approved = approvedOf(item)
                    const changed = approved !== item.amount
                    return (
                      <tr key={item.id} className="border-t align-top">
                        <td className="px-3 py-2.5">
                          {item.description}
                          {changed ? (
                            <Input
                              className="mt-2 h-8 text-xs"
                              placeholder="Alasan penyesuaian (wajib)"
                              aria-label={`Alasan penyesuaian ${item.description}`}
                              value={notes[item.id] ?? ""}
                              onChange={(e) => setNotes((prev) => ({ ...prev, [item.id]: e.target.value }))}
                            />
                          ) : null}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums whitespace-nowrap">{formatRupiah(item.amount)}</td>
                        <td className="px-3 py-1.5">
                          <AmountInput
                            id={`approved-${item.id}`}
                            label={`Nominal disetujui ${item.description}`}
                            value={values[item.id] ?? ""}
                            onChange={(v) => setValues((prev) => ({ ...prev, [item.id]: v }))}
                            invalid={approved > item.amount}
                            changed={changed}
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {bpjsCovered > 0 ? (
            <p className="text-xs text-muted-foreground">Dikurangi tanggungan BPJS {formatRupiah(bpjsCovered)}.</p>
          ) : null}
          {invalid ? (
            <p className="text-xs text-destructive">Nominal disetujui tidak boleh melebihi yang diajukan.</p>
          ) : missingNote ? (
            <p className="text-xs text-amber-700 dark:text-amber-400">Tulis alasan untuk nominal yang disesuaikan.</p>
          ) : null}
          {capped ? (
            <p className="flex items-start gap-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              Nominal melebihi sisa plafon, sehingga yang disetujui dibatasi menjadi {formatRupiah(payable)}.
            </p>
          ) : null}
        </section>

        {/* Catatan */}
        <section className="grid gap-1.5">
          <Label htmlFor="reviewNote">
            Catatan untuk pegawai <span className="font-normal text-muted-foreground">(opsional)</span>
          </Label>
          <Textarea id="reviewNote" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </section>
      </CardContent>

      {/* Tindakan */}
      <div className="flex flex-col-reverse gap-2 border-t px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2">
          <Button variant="outline" disabled={isPending} onClick={() => setDialog("REVISI")}>
            <RotateCcw className="size-4" />
            Minta Revisi
          </Button>
          <Button variant="destructive" disabled={isPending} onClick={() => setDialog("TOLAK")}>
            <X className="size-4" />
            Tolak
          </Button>
        </div>
        <Button
          size="lg"
          disabled={isPending || Boolean(invalid) || Boolean(missingNote) || payable <= 0}
          onClick={() =>
            run(() =>
              confirmHealthClaimAction(publicId, {
                items: items.map((i) => ({ id: i.id, approvedAmount: approvedOf(i), note: notes[i.id] })),
                note,
              })
            )
          }
        >
          {isPending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
          Konfirmasi {formatRupiah(payable)}
        </Button>
      </div>

      <Dialog
        open={dialog !== null}
        onOpenChange={(open) => {
          if (!open && !isPending) {
            setDialog(null)
            setDialogNote("")
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialog === "REVISI" ? `Minta revisi ${claimNumber}` : `Tolak ${claimNumber}`}</DialogTitle>
            <DialogDescription>
              {dialog === "REVISI"
                ? "Klaim dikembalikan ke pegawai untuk diperbaiki, lalu diperiksa ulang. Jelaskan apa yang perlu diperbaiki."
                : "Klaim ditolak dan plafon yang tertahan dilepas. Jelaskan alasannya kepada pegawai."}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            rows={4}
            autoFocus
            placeholder={dialog === "REVISI" ? "mis. Foto kuitansi kurang jelas, mohon unggah hasil scan." : "mis. Biaya kosmetik tidak termasuk tanggungan."}
            value={dialogNote}
            onChange={(e) => setDialogNote(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" disabled={isPending} onClick={() => setDialog(null)}>
              Batal
            </Button>
            <Button
              variant={dialog === "TOLAK" ? "destructive" : "default"}
              disabled={isPending || dialogNote.trim().length < 5}
              onClick={() =>
                run(
                  () =>
                    dialog === "REVISI"
                      ? requestHealthClaimRevisionAction(publicId, dialogNote)
                      : rejectHealthClaimAction(publicId, dialogNote),
                  () => {
                    setDialog(null)
                    setDialogNote("")
                  }
                )
              }
            >
              {dialog === "REVISI" ? "Kirim Permintaan Revisi" : "Tolak Klaim"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
