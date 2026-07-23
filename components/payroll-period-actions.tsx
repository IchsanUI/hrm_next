"use client"

import { useTransition } from "react"
import { toast } from "sonner"

import {
  generatePayslipsAction,
  lockPayrollPeriodAction,
  unlockPayrollPeriodAction,
} from "@/server/actions/payroll-period"
import { Button } from "@/components/ui/button"

export function PayrollPeriodActions({
  periodId,
  status,
}: {
  periodId: number
  status: "DRAFT" | "LOCKED"
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

  function handleLock() {
    startTransition(async () => {
      const result = await lockPayrollPeriodAction(periodId)
      if (result?.error) {
        toast.error(result.error)
      } else {
        toast.success("Periode berhasil dikunci.")
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
    return (
      <Button variant="outline" disabled={isPending} onClick={handleUnlock}>
        Buka Kunci
      </Button>
    )
  }

  return (
    <div className="flex gap-2">
      <Button variant="outline" disabled={isPending} onClick={handleGenerate}>
        {isPending ? "Memproses..." : "Generate/Refresh Payslip"}
      </Button>
      <Button disabled={isPending} onClick={handleLock}>
        Kunci Periode
      </Button>
    </div>
  )
}
