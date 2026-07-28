"use client"

import { useTransition } from "react"
import { toast } from "sonner"

import {
  generatePayslipsAction,
  submitPayrollApprovalAction,
  approvePayrollPeriodAction,
  rejectPayrollApprovalAction,
  unlockPayrollPeriodAction,
} from "@/server/actions/payroll-period"
import { Button } from "@/components/ui/button"
import { RejectDialog } from "@/components/reject-dialog"

export function PayrollPeriodActions({
  periodId,
  status,
  role,
}: {
  periodId: number
  status: "DRAFT" | "PENDING_APPROVAL" | "LOCKED"
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

  function handleApprove() {
    startTransition(async () => {
      const result = await approvePayrollPeriodAction(periodId)
      if (result?.error) {
        toast.error(result.error)
      } else {
        toast.success("Periode disetujui & dikunci.")
      }
    })
  }

  function handleUnlock() {
    startTransition(async () => {
      const result = await unlockPayrollPeriodAction(periodId)
      if (result?.error) {
        toast.error(result.error)
      } else {
        toast.success("Kunci periode dibuka.")
      }
    })
  }

  if (status === "LOCKED") {
    if (role !== "SUPER_ADMIN") return null
    return (
      <Button variant="outline" disabled={isPending} onClick={handleUnlock}>
        Buka Kunci
      </Button>
    )
  }

  if (status === "PENDING_APPROVAL") {
    if (role !== "SUPER_ADMIN") {
      return (
        <p className="text-sm text-muted-foreground">
          Menunggu persetujuan Super Admin.
        </p>
      )
    }
    return (
      <div className="flex gap-2">
        <Button disabled={isPending} onClick={handleApprove}>
          Setujui &amp; Kunci
        </Button>
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
      <Button disabled={isPending} onClick={handleSubmitApproval}>
        Ajukan Approval
      </Button>
    </div>
  )
}
