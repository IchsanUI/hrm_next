"use client"

import type { PayrollPeriodStatus } from "@prisma/client"
import { useRef, useState, useTransition, type FormEvent } from "react"
import { toast } from "sonner"

import { requestPayrollUnlockAction } from "@/server/actions/payroll-approval"
import {
  generatePayslipsAction,
  importPayslipsAction,
  submitPayrollApprovalAction,
  approvePayrollPeriodAction,
  rejectPayrollApprovalAction,
  unlockPayrollPeriodAction,
} from "@/server/actions/payroll-period"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { RejectDialog } from "@/components/reject-dialog"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"

function ImportPayslipsDialog({ periodId }: { periodId: number }) {
  const [open, setOpen] = useState(false)
  const [isImporting, startImportTransition] = useTransition()
  const [importError, setImportError] = useState<string | null>(null)
  const formRef = useRef<HTMLFormElement>(null)

  function handleImportSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    startImportTransition(async () => {
      const result = await importPayslipsAction(periodId, undefined, formData)
      if (!result) return
      if (!result.success) {
        setImportError(result.error)
        toast.error(result.error)
        return
      }
      setImportError(null)
      setOpen(false)
      formRef.current?.reset()
      toast.success(`${result.generated} payslip berhasil diimpor dari Excel.`)
    })
  }

  return (
    <>
      <Button
        variant="outline"
        onClick={() => {
          setImportError(null)
          setOpen(true)
        }}
      >
        Import Manual
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Payroll dari Excel</DialogTitle>
            <DialogDescription>
              Dipakai kalau perhitungan bulan ini hasil hitungan manual (bukan generate otomatis).
              Import ini MENIMPA TOTAL payslip periode ini yang sudah ada.
            </DialogDescription>
          </DialogHeader>
          <form ref={formRef} onSubmit={handleImportSubmit} className="grid gap-4">
            <p className="text-sm text-muted-foreground">
              Unduh template dulu (sudah berisi Nama &amp; Jabatan tiap pegawai), isi kolom nominal
              manual, lalu unggah file-nya di sini.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-fit"
              nativeButton={false}
              render={<a href={`/api/payroll/proses/${periodId}/template`} download />}
            >
              Unduh Template
            </Button>
            <div className="grid gap-2">
              <Label htmlFor="import-payroll-file">File Excel (.xlsx)</Label>
              <Input id="import-payroll-file" name="file" type="file" accept=".xlsx" required />
            </div>
            {importError ? <p className="text-destructive text-sm">{importError}</p> : null}
            <DialogFooter>
              <Button type="submit" disabled={isImporting}>
                {isImporting ? "Mengimpor..." : "Import"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}

// Dialog beralasan-wajib — dipakai untuk SEMUA jalur override darurat
// SUPER_ADMIN (setujui paksa & buka paksa). Alasannya bukan formalitas:
// dipakai sebagai catatan pada step yang dilangkahi dan masuk activity log,
// jadi saat audit terlihat kenapa penyetuju resmi dilewati.
function ReasonDialog({
  trigger,
  title,
  description,
  isPending,
  onSubmit,
}: {
  trigger: string
  title: string
  description: string
  isPending: boolean
  onSubmit: (reason: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState("")

  return (
    <>
      <Button variant="outline" disabled={isPending} onClick={() => setOpen(true)}>
        {trigger}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{description}</p>
          <div className="grid gap-2">
            <Label htmlFor="override-reason">Alasan (wajib)</Label>
            <Textarea
              id="override-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Mis. Direktur penyetuju sedang cuti panjang, gaji harus dibayarkan hari ini."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
              Batal
            </Button>
            <Button
              disabled={isPending || reason.trim().length < 5}
              onClick={() => {
                onSubmit(reason)
                setOpen(false)
              }}
            >
              {isPending ? "Memproses..." : "Lanjutkan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// Jalur NORMAL koreksi periode terkunci: HR mengajukan, penyetuju memutuskan.
function RequestUnlockDialog({ periodId }: { periodId: number }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState("")
  const [isPending, startTransition] = useTransition()

  function handleSubmit() {
    const formData = new FormData()
    formData.set("reason", reason)
    startTransition(async () => {
      const result = await requestPayrollUnlockAction(periodId, undefined, formData)
      if (result?.error) {
        toast.error(result.error)
        return
      }
      setOpen(false)
      toast.success("Permintaan koreksi diajukan ke penyetuju.")
    })
  }

  return (
    <>
      <Button variant="outline" disabled={isPending} onClick={() => setOpen(true)}>
        Ajukan Koreksi
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajukan koreksi payroll</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Periode ini sudah final dan slipnya sudah dilihat pegawai. Jelaskan apa yang perlu
            diperbaiki — penyetuju yang ditunjuk akan memutuskan apakah periode boleh dibuka lagi.
          </p>
          <div className="grid gap-2">
            <Label htmlFor="unlock-reason">Alasan koreksi (wajib)</Label>
            <Textarea
              id="unlock-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Mis. Tunjangan kehadiran 3 pegawai salah hitung karena data absensi terlambat sinkron."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
              Batal
            </Button>
            <Button disabled={isPending || reason.trim().length < 5} onClick={handleSubmit}>
              {isPending ? "Mengajukan..." : "Ajukan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export function PayrollPeriodActions({
  periodId,
  status,
  role,
}: {
  periodId: number
  status: PayrollPeriodStatus
  // Role user yang login — dipakai buat membedakan tampilan HR_ADMIN (yang
  // mengajukan) vs SUPER_ADMIN (yang approve/tolak). Aksi approve/tolak/buka
  // kunci tetap divalidasi ulang di server action, ini cuma UI gating.
  role: "SUPER_ADMIN" | "HR_ADMIN" | "EMPLOYEE"
}) {
  const [isPending, startTransition] = useTransition()

  function handleGenerate() {
    startTransition(async () => {
      const result = await generatePayslipsAction(periodId)
      if (!result) return
      if (!result.success) {
        toast.error(result.error)
        return
      }
      toast.success(`${result.generated} payslip berhasil digenerate.`)
      if (result.warnings.length > 0) {
        toast.warning(`${result.warnings.length} catatan perlu dicek.`, {
          description: result.warnings.slice(0, 5).join(" "),
        })
      }
    })
  }

  function handleSubmitApproval() {
    startTransition(async () => {
      const result = await submitPayrollApprovalAction(periodId)
      if (result?.error) {
        toast.error(result.error)
      } else {
        toast.success("Periode diajukan untuk approval Super Admin.")
      }
    })
  }

  function handleApprove(overrideReason?: string) {
    startTransition(async () => {
      const result = await approvePayrollPeriodAction(periodId, overrideReason)
      if (result?.error) {
        toast.error(result.error)
      } else {
        toast.success("Periode disetujui & dikunci.")
      }
    })
  }

  function handleUnlock(reason?: string) {
    startTransition(async () => {
      const result = await unlockPayrollPeriodAction(periodId, reason)
      if (result?.error) {
        toast.error(result.error)
      } else {
        toast.success("Kunci periode dibuka.")
      }
    })
  }

  if (status === "PENDING_UNLOCK_APPROVAL") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm text-muted-foreground">
          Permintaan koreksi sedang menunggu keputusan penyetuju.
        </p>
        {role === "SUPER_ADMIN" ? (
          <ReasonDialog
            trigger="Buka Paksa (Darurat)"
            title="Buka kunci tanpa menunggu penyetuju?"
            description="Dipakai hanya kalau penyetuju yang ditunjuk berhalangan lama. Tindakan ini dicatat sebagai override darurat beserta alasannya dan ditandai di periode."
            isPending={isPending}
            onSubmit={handleUnlock}
          />
        ) : null}
      </div>
    )
  }

  if (status === "LOCKED") {
    return (
      <div className="flex flex-wrap gap-2">
        {/* Jalur NORMAL koreksi: HR mengajukan, penyetuju yang memutuskan. */}
        <RequestUnlockDialog periodId={periodId} />
        {role === "SUPER_ADMIN" ? (
          <ReasonDialog
            trigger="Buka Paksa (Darurat)"
            title="Buka kunci langsung tanpa persetujuan?"
            description="Jalur normalnya adalah Ajukan Koreksi supaya diperiksa penyetuju. Pakai ini hanya saat penyetuju berhalangan lama — akan dicatat sebagai override darurat."
            isPending={isPending}
            onSubmit={handleUnlock}
          />
        ) : null}
      </div>
    )
  }

  if (status === "PENDING_APPROVAL") {
    if (role !== "SUPER_ADMIN") {
      return (
        <p className="text-sm text-muted-foreground">
          Menunggu keputusan penyetuju yang ditunjuk.
        </p>
      )
    }
    return (
      <div className="flex flex-wrap gap-2">
        <Button disabled={isPending} onClick={() => handleApprove()}>
          Setujui &amp; Kunci
        </Button>
        <ReasonDialog
          trigger="Setujui Paksa (Darurat)"
          title="Setujui tanpa menunggu penyetuju?"
          description="Dipakai hanya kalau penyetuju yang ditunjuk berhalangan lama. Tindakan ini dicatat sebagai override darurat beserta alasannya."
          isPending={isPending}
          onSubmit={(reason) => handleApprove(reason)}
        />
        <RejectDialog
          requestId={periodId}
          applicant="periode payroll ini"
          title="Tolak Approval Payroll"
          successMessage="Periode ditolak, dikembalikan ke Draft."
          rejectAction={rejectPayrollApprovalAction}
        />
      </div>
    )
  }

  // status === "DRAFT"
  return (
    <div className="flex gap-2">
      <Button variant="outline" disabled={isPending} onClick={handleGenerate}>
        {isPending ? "Memproses..." : "Generate/Refresh Payslip"}
      </Button>
      <ImportPayslipsDialog periodId={periodId} />
      <Button disabled={isPending} onClick={handleSubmitApproval}>
        Ajukan Approval
      </Button>
    </div>
  )
}
