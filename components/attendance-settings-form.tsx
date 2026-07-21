"use client"

import { useTransition, type FormEvent } from "react"
import { toast } from "sonner"

import { updateAttendancePollSecondsAction } from "@/server/actions/attendance"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function AttendanceSettingsForm({ pollSeconds }: { pollSeconds: number }) {
  const [isPending, startTransition] = useTransition()

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    startTransition(async () => {
      const result = await updateAttendancePollSecondsAction(undefined, formData)
      if (result?.error) {
        toast.error(result.error)
      } else {
        toast.success("Pengaturan interval polling disimpan.")
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
      <div className="grid gap-2">
        <Label htmlFor="pollSeconds">Interval Polling (detik)</Label>
        <Input
          id="pollSeconds"
          name="pollSeconds"
          type="number"
          min={5}
          defaultValue={pollSeconds}
          className="w-40"
        />
      </div>
      <Button type="submit" disabled={isPending}>
        {isPending ? "Menyimpan..." : "Simpan"}
      </Button>
    </form>
  )
}
