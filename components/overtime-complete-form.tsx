"use client"

import { useState, useTransition, type FormEvent } from "react"
import { toast } from "sonner"
import { ClipboardCheck } from "lucide-react"

import {
  completeOvertimeRequestAction,
  type OvertimeFormState,
} from "@/server/actions/overtime"
import { MAX_OVERTIME_PROOF_FILES } from "@/lib/validations/overtime"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { CameraCaptureInput } from "@/components/camera-capture-input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export function OvertimeCompleteForm({ requestId }: { requestId: number }) {
  const [state, setState] = useState<OvertimeFormState>(undefined)
  const [isPending, startTransition] = useTransition()
  const [proofFiles, setProofFiles] = useState<File[]>([])

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (proofFiles.length === 0) {
      toast.error("Bukti lembur wajib diambil minimal 1 foto.")
      return
    }

    const formData = new FormData(event.currentTarget)
    proofFiles.forEach((file) => formData.append("proof", file))

    startTransition(async () => {
      const result = await completeOvertimeRequestAction(requestId, undefined, formData)
      setState(result)
      if (result?.error) {
        toast.error(result.error)
        return
      }
      toast.success("Hasil lembur berhasil dilengkapi.")
    })
  }

  return (
    <Card>
      <CardHeader className="flex items-start gap-3 border-b">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <ClipboardCheck className="size-4.5" />
        </span>
        <div>
          <CardTitle>Lengkapi Hasil Lembur</CardTitle>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Tahap 2 dari 2 — isi jam aktual, hasil, dan bukti lembur yang sudah dilaksanakan.
          </p>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor={`actualStartTime-${requestId}`}>Jam Mulai</Label>
              <Input
                id={`actualStartTime-${requestId}`}
                name="actualStartTime"
                type="time"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`actualEndTime-${requestId}`}>Jam Selesai</Label>
              <Input
                id={`actualEndTime-${requestId}`}
                name="actualEndTime"
                type="time"
                required
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`resultDescription-${requestId}`}>Deskripsi Lembur</Label>
            <Textarea
              id={`resultDescription-${requestId}`}
              name="resultDescription"
              placeholder="Jelaskan pekerjaan yang sudah dikerjakan saat lembur"
              required
            />
          </div>
          <div className="grid gap-2">
            <Label>Bukti Lembur</Label>
            <CameraCaptureInput
              files={proofFiles}
              onChange={setProofFiles}
              maxFiles={MAX_OVERTIME_PROOF_FILES}
            />
            <p className="text-xs text-muted-foreground">
              Bisa ambil lebih dari satu foto — tiap foto langsung lewat kamera, bukan pilih dari galeri.
            </p>
          </div>
          {state?.error ? (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {state.error}
            </p>
          ) : null}
          <div className="flex justify-end">
            <Button type="submit" disabled={isPending}>
              {isPending ? "Menyimpan..." : "Simpan Hasil Lembur"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
