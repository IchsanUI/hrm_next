"use client"

import { useActionState, useEffect } from "react"
import { toast } from "sonner"

import {
  resubmitMaternityLeaveRequestAction,
  type MaternityLeaveFormState,
} from "@/server/actions/maternity-leave"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

export function MaternityLeaveResubmitForm({
  requestId,
  colleagues,
}: {
  requestId: number
  colleagues: { id: number; fullName: string; position: { name: string } }[]
}) {
  const action = resubmitMaternityLeaveRequestAction.bind(null, requestId)
  const [state, formAction, isPending] = useActionState<MaternityLeaveFormState, FormData>(
    action,
    undefined
  )

  useEffect(() => {
    if (state?.error) toast.error(state.error)
  }, [state])

  return (
    <form action={formAction} className="grid gap-2">
      <Label htmlFor={`newSubstitute-${requestId}`}>Pegawai Pengganti Baru</Label>
      <div className="flex flex-wrap items-center gap-2">
        <select
          id={`newSubstitute-${requestId}`}
          name="newSubstituteEmployeeId"
          defaultValue=""
          required
          className="h-9 min-w-48 max-w-full rounded-lg border border-input bg-transparent px-3 text-sm dark:bg-input/30"
        >
          <option value="" disabled>
            Pilih pegawai pengganti
          </option>
          {colleagues.map((c) => (
            <option key={c.id} value={c.id}>
              {c.fullName} — {c.position.name}
            </option>
          ))}
        </select>
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "Mengirim..." : "Ajukan Ulang"}
        </Button>
      </div>
      {state?.error ? <p className="text-destructive text-sm">{state.error}</p> : null}
    </form>
  )
}
