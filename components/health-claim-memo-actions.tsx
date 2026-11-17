"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Check, Loader2, MinusCircle, Pencil, RotateCcw, Send, X } from "lucide-react"
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
import { DISPOSITION_LABEL, formatRupiah, type DispositionValue } from "@/lib/health-claim-labels"
import {
  adjustMemoItemAction,
  approveMemoStepAction,
  cancelMemoAction,
  dispositionMemoAction,
  removeMemoItemAction,
  resubmitMemoAction,
  returnMemoAction,
  type MemoActionResult,
} from "@/server/actions/health-claim-memo"
import { cn } from "@/lib/utils"

function useRun() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const run = (fn: () => Promise<MemoActionResult>, after?: () => void) =>
    startTransition(async () => {
      const result = await fn()
      if ("error" in result) toast.error(result.error)
      else {
        toast.success(result.success)
        after?.()
        router.refresh()
      }
    })
  return { isPending, run }
}

// ── Panel penyetuju (langkah biasa atau disposisi) ───────────

const DISPOSITIONS: DispositionValue[] = ["SETUJU", "SETUJU_CATATAN", "TINJAU_ULANG", "TIDAK_SETUJU"]
const DISPOSITION_HINT: Record<DispositionValue, string> = {
  SETUJU: "Nota Dinas disetujui dan diteruskan untuk pembayaran.",
  SETUJU_CATATAN: "Disetujui, dengan catatan untuk pembuat dan Accounting.",
  TINJAU_ULANG: "Dikembalikan ke petugas untuk diperbaiki.",
  TIDAK_SETUJU: "Seluruh klaim di Nota Dinas ini ditolak.",
}

export function MemoApproverPanel({
  publicId,
  stepType,
  stepLabel,
  total,
}: {
  publicId: string
  stepType: "ATASAN_LANGSUNG" | "KEPALA_DEPARTEMEN" | "PEGAWAI_TERTENTU" | "DISPOSISI_DIREKTUR"
  stepLabel: string
  total: number
}) {
  const { isPending, run } = useRun()
  const [note, setNote] = useState("")
  const [decision, setDecision] = useState<DispositionValue>("SETUJU")
  const isDisposition = stepType === "DISPOSISI_DIREKTUR"
  const needsNote = isDisposition ? decision !== "SETUJU" : false

  return (
    <Card className="border-primary/40">
      <CardHeader className="border-b">
        <CardTitle>{isDisposition ? "Disposisi Direksi" : "Persetujuan Anda"}</CardTitle>
        <CardDescription>
          Anda bertindak sebagai <span className="font-medium">{stepLabel}</span>. Total Nota Dinas {formatRupiah(total)}.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 pt-2">
        {isDisposition ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {DISPOSITIONS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDecision(d)}
                aria-pressed={decision === d}
                className={cn(
                  "rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                  decision === d ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted/50",
                  d === "TIDAK_SETUJU" && decision === d && "border-destructive bg-destructive/5 ring-destructive"
                )}
              >
                <span className="block font-medium">{DISPOSITION_LABEL[d]}</span>
                <span className="text-xs text-muted-foreground">{DISPOSITION_HINT[d]}</span>
              </button>
            ))}
          </div>
        ) : null}
        <div className="grid gap-1.5">
          <Label htmlFor="memoNote">
            {isDisposition ? "Catatan disposisi" : "Catatan"}
            {needsNote ? <span className="text-destructive"> *</span> : <span className="text-muted-foreground"> (opsional)</span>}
          </Label>
          <Textarea id="memoNote" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-2">
          {isDisposition ? (
            <Button
              disabled={isPending || (needsNote && note.trim().length < 5)}
              variant={decision === "TIDAK_SETUJU" ? "destructive" : "default"}
              onClick={() => run(() => dispositionMemoAction(publicId, decision, note))}
            >
              {isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              Simpan Disposisi
            </Button>
          ) : (
            <>
              <Button disabled={isPending} onClick={() => run(() => approveMemoStepAction(publicId, note))}>
                {isPending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                Setujui
              </Button>
              <Button
                variant="outline"
                disabled={isPending || note.trim().length < 5}
                onClick={() => run(() => returnMemoAction(publicId, note))}
                title={note.trim().length < 5 ? "Tulis catatan untuk mengembalikan" : undefined}
              >
                <RotateCcw className="size-4" />
                Kembalikan ke Petugas
              </Button>
            </>
          )}
        </div>
        {!isDisposition ? (
          <p className="text-xs text-muted-foreground">Untuk mengembalikan, tulis catatan apa yang perlu diperbaiki.</p>
        ) : null}
      </CardContent>
    </Card>
  )
}

// ── Tindakan per baris klaim ────────────────────────────────

export function MemoItemActions({
  memoPublicId,
  claimPublicId,
  claimNumber,
  amount,
  canAdjust,
  canRemove,
}: {
  memoPublicId: string
  claimPublicId: string
  claimNumber: string
  amount: number
  canAdjust: boolean
  canRemove: boolean
}) {
  const { isPending, run } = useRun()
  const [mode, setMode] = useState<"adjust" | "remove" | null>(null)
  const [newAmount, setNewAmount] = useState("")
  const [note, setNote] = useState("")
  const parsed = Number(newAmount.replace(/\D/g, "")) || 0
  const close = () => {
    setMode(null)
    setNote("")
    setNewAmount("")
  }

  if (!canAdjust && !canRemove) return null
  return (
    <div className="flex justify-end gap-1">
      {canAdjust ? (
        <Button size="icon-sm" variant="ghost" aria-label={`Ubah nominal ${claimNumber}`} onClick={() => setMode("adjust")}>
          <Pencil className="size-4" />
        </Button>
      ) : null}
      {canRemove ? (
        <Button size="icon-sm" variant="ghost" aria-label={`Keluarkan ${claimNumber}`} onClick={() => setMode("remove")}>
          <MinusCircle className="size-4 text-destructive" />
        </Button>
      ) : null}
      <Dialog open={mode !== null} onOpenChange={(open) => !open && !isPending && close()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{mode === "adjust" ? `Turunkan nominal ${claimNumber}` : `Keluarkan ${claimNumber}`}</DialogTitle>
            <DialogDescription>
              {mode === "adjust"
                ? `Nominal saat ini ${formatRupiah(amount)}. Nominal hanya bisa diturunkan, dan alasannya terlihat oleh pegawai.`
                : "Klaim dikeluarkan dari Nota Dinas ini dan kembali ke antrean untuk Nota Dinas berikutnya."}
            </DialogDescription>
          </DialogHeader>
          {mode === "adjust" ? (
            <div className="grid gap-1.5">
              <Label htmlFor="newAmount">Nominal baru</Label>
              <Input
                id="newAmount"
                inputMode="numeric"
                value={newAmount}
                onChange={(e) => {
                  const n = Number(e.target.value.replace(/\D/g, "")) || 0
                  setNewAmount(n ? n.toLocaleString("id-ID") : "")
                }}
              />
            </div>
          ) : null}
          <div className="grid gap-1.5">
            <Label htmlFor="itemNote">Alasan</Label>
            <Textarea id="itemNote" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={isPending} onClick={close}>
              Batal
            </Button>
            <Button
              variant={mode === "remove" ? "destructive" : "default"}
              disabled={isPending || note.trim().length < 5 || (mode === "adjust" && (parsed <= 0 || parsed >= amount))}
              onClick={() =>
                run(
                  () =>
                    mode === "adjust"
                      ? adjustMemoItemAction(memoPublicId, claimPublicId, parsed, note)
                      : removeMemoItemAction(memoPublicId, claimPublicId, note),
                  close
                )
              }
            >
              {mode === "adjust" ? "Simpan Nominal" : "Keluarkan Klaim"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Panel petugas saat Nota Dinas dikembalikan ──────────────

export function MemoPetugasPanel({
  publicId,
  memoNumber,
  canResubmit,
  canCancel,
  opening,
  closing,
  rows,
}: {
  publicId: string
  memoNumber: string
  canResubmit: boolean
  canCancel: boolean
  opening: string
  closing: string
  rows: { claimPublicId: string; label: string; note: string }[]
}) {
  const { isPending, run } = useRun()
  const [openingText, setOpeningText] = useState(opening)
  const [closingText, setClosingText] = useState(closing)
  const [notes, setNotes] = useState<Record<string, string>>(() => Object.fromEntries(rows.map((r) => [r.claimPublicId, r.note])))
  const [cancelOpen, setCancelOpen] = useState(false)
  const [reason, setReason] = useState("")

  return (
    <Card className="border-orange-300 dark:border-orange-800">
      <CardHeader className="border-b">
        <CardTitle>{canResubmit ? "Perbaiki & Ajukan Ulang" : "Tindakan Petugas"}</CardTitle>
        <CardDescription>
          {canResubmit
            ? "Sunting teks atau keterangan, keluarkan klaim bila perlu (ikon di tabel), lalu ajukan ulang. Saldo awal dihitung ulang otomatis."
            : "Nota Dinas belum diproses penyetuju, sehingga masih bisa dibatalkan."}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 pt-2">
        {canResubmit ? (
          <>
            <div className="grid gap-1.5">
              <Label htmlFor="opening">Teks pembuka</Label>
              <Textarea id="opening" rows={4} value={openingText} onChange={(e) => setOpeningText(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Keterangan per klaim</Label>
              {rows.map((r) => (
                <div key={r.claimPublicId} className="grid gap-1 sm:grid-cols-[200px_1fr] sm:items-center">
                  <span className="truncate text-sm text-muted-foreground">{r.label}</span>
                  <Input
                    value={notes[r.claimPublicId] ?? ""}
                    onChange={(e) => setNotes((prev) => ({ ...prev, [r.claimPublicId]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="closing">Teks penutup</Label>
              <Textarea id="closing" rows={3} value={closingText} onChange={(e) => setClosingText(e.target.value)} />
            </div>
          </>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {canResubmit ? (
            <Button
              disabled={isPending}
              onClick={() => run(() => resubmitMemoAction(publicId, { opening: openingText, closing: closingText, notes }))}
            >
              {isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              Ajukan Ulang
            </Button>
          ) : null}
          {canCancel ? (
            <Button variant="outline" className="text-destructive" disabled={isPending} onClick={() => setCancelOpen(true)}>
              <X className="size-4" />
              Batalkan Nota Dinas
            </Button>
          ) : null}
        </div>
      </CardContent>
      <Dialog open={cancelOpen} onOpenChange={(open) => !open && !isPending && setCancelOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Batalkan {memoNumber}?</DialogTitle>
            <DialogDescription>
              Semua klaim di dalamnya kembali ke antrean Nota Dinas. Nota Dinas yang dibatalkan tetap tersimpan sebagai arsip.
            </DialogDescription>
          </DialogHeader>
          <Textarea rows={3} placeholder="Alasan pembatalan" value={reason} onChange={(e) => setReason(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" disabled={isPending} onClick={() => setCancelOpen(false)}>
              Tidak
            </Button>
            <Button
              variant="destructive"
              disabled={isPending || reason.trim().length < 5}
              onClick={() => run(() => cancelMemoAction(publicId, reason), () => setCancelOpen(false))}
            >
              Batalkan Nota Dinas
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
