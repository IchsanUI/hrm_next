"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"

import { decidePayrollApprovalAction } from "@/server/actions/payroll-approval"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

export function PayrollApprovalDecision({
  periodId,
  periodLabel,
  stageLabel,
  reason,
}: {
  periodId: number
  periodLabel: string
  stageLabel: string
  // Alasan yang ditulis HR saat mengajukan koreksi — konteks penting buat
  // penyetuju tahap UNLOCK.
  reason: string | null
}) {
  const [notes, setNotes] = useState("")
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  function submit(decision: "APPROVE" | "REJECT") {
    const formData = new FormData()
    formData.set("notes", notes)
    startTransition(async () => {
      const result = await decidePayrollApprovalAction(periodId, decision, undefined, formData)
      if (result?.error) {
        toast.error(result.error)
        return
      }
      setConfirmOpen(false)
      toast.success(decision === "APPROVE" ? "Persetujuan tersimpan." : "Penolakan tersimpan.")
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Keputusan Anda — Persetujuan {stageLabel}</CardTitle>
        <CardDescription>
          {stageLabel === "Koreksi"
            ? "Menyetujui berarti periode yang sudah final dibuka kembali supaya HR bisa memperbaikinya."
            : "Menyetujui berarti payroll dikunci dan slip gaji langsung terbit ke seluruh pegawai."}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {reason ? (
          <div className="rounded-lg border bg-muted/40 p-3 text-sm">
            <p className="text-xs font-medium text-muted-foreground">Catatan dari pengaju</p>
            <p>{reason}</p>
          </div>
        ) : null}

        <div className="grid gap-2">
          <Label htmlFor="notes">Catatan {stageLabel === "Koreksi" ? "" : "(opsional untuk setuju)"}</Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Catatan keputusan Anda. Wajib diisi kalau menolak."
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" disabled={isPending} onClick={() => setConfirmOpen(true)}>
            Setujui
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={isPending}
            onClick={() => submit("REJECT")}
          >
            {isPending ? "Memproses..." : "Tolak"}
          </Button>
        </div>
      </CardContent>

      {/* Konfirmasi WAJIB sebelum menyetujui — setelah tahap terakhir lolos,
          data payroll jadi final & slipnya langsung tersebar ke pegawai.
          Memperbaikinya harus lewat permintaan koreksi yang disetujui lagi. */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Setujui payroll {periodLabel}?</AlertDialogTitle>
            <AlertDialogDescription>
              {stageLabel === "Koreksi"
                ? "Periode yang sudah final akan dibuka kembali sehingga angkanya bisa diubah HR. Pegawai akan diberi tahu ulang setelah perbaikannya dikunci lagi."
                : "Kalau Anda tahap terakhir, payroll langsung TERKUNCI dan slip gaji terbit ke seluruh pegawai saat itu juga. Setelah itu angkanya tidak bisa diubah begitu saja — HR harus mengajukan koreksi dan menunggu persetujuan lagi."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Batal</AlertDialogCancel>
            <AlertDialogAction disabled={isPending} onClick={() => submit("APPROVE")}>
              {isPending ? "Memproses..." : "Ya, Setujui"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
