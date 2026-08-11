"use client"

import { useActionState, useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import {
  uploadEmployeeDocumentAction,
  type DocumentUploadState,
  type EmployeeDocType,
} from "@/server/actions/employee-documents"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"

type MaritalStatus = "SINGLE" | "MARRIED" | "DIVORCED" | "WIDOWED" | null

function maritalDocLabel(maritalStatus: MaritalStatus) {
  if (maritalStatus === "MARRIED") return "Surat Nikah"
  if (maritalStatus === "DIVORCED") return "Akta Cerai"
  return "Surat Nikah / Akta Cerai"
}

function DocumentSlot({
  employeeId,
  employeePublicId,
  docType,
  label,
  hasFile,
}: {
  employeeId: number
  employeePublicId: string
  docType: EmployeeDocType
  label: string
  hasFile: boolean
}) {
  const [open, setOpen] = useState(false)
  const action = uploadEmployeeDocumentAction.bind(null, employeeId, docType)
  const [state, formAction, isPending] = useActionState<DocumentUploadState, FormData>(
    action,
    undefined
  )
  const formRef = useRef<HTMLFormElement>(null)
  const wasPending = useRef(false)

  useEffect(() => {
    if (!wasPending.current || isPending) {
      wasPending.current = isPending
      return
    }
    wasPending.current = isPending
    if (state?.error) {
      toast.error(state.error)
      return
    }
    if (state?.success) {
      toast.success(`${label} berhasil diunggah.`)
      formRef.current?.reset()
      setOpen(false)
    }
  }, [isPending, state, label])

  return (
    <div className="flex flex-col gap-1.5 rounded-md border p-3">
      <p className="text-sm font-medium">{label}</p>
      {hasFile ? (
        <a
          href={`/api/pegawai/${employeePublicId}/dokumen/${docType}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-primary underline-offset-4 hover:underline"
        >
          Lihat Dokumen
        </a>
      ) : (
        <p className="text-xs text-muted-foreground">Belum diunggah</p>
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-1 w-fit"
        onClick={() => setOpen(true)}
      >
        {hasFile ? "Ganti" : "Upload"}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload {label}</DialogTitle>
            <DialogDescription>Format PDF, JPG, atau PNG. Maksimal 5MB.</DialogDescription>
          </DialogHeader>
          <form ref={formRef} action={formAction} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor={`file-${docType}`}>File</Label>
              <Input
                id={`file-${docType}`}
                name="file"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                required
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Mengunggah..." : "Upload"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export function EmployeePersonalDocumentsCard({
  employeeId,
  employeePublicId,
  maritalStatus,
  hasKtp,
  hasKk,
  hasNpwp,
  hasMaritalDocument,
}: {
  employeeId: number
  employeePublicId: string
  maritalStatus: MaritalStatus
  hasKtp: boolean
  hasKk: boolean
  hasNpwp: boolean
  hasMaritalDocument: boolean
}) {
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Dokumen Pribadi</CardTitle>
        <CardDescription>
          Scan KTP, Kartu Keluarga, NPWP, dan Surat Nikah/Akta Cerai — cuma bisa dilihat oleh
          Super Admin/HR Admin dan pegawai yang bersangkutan.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 pt-4 sm:grid-cols-2 lg:grid-cols-4">
        <DocumentSlot
          employeeId={employeeId}
          employeePublicId={employeePublicId}
          docType="ktp"
          label="KTP"
          hasFile={hasKtp}
        />
        <DocumentSlot
          employeeId={employeeId}
          employeePublicId={employeePublicId}
          docType="kk"
          label="Kartu Keluarga"
          hasFile={hasKk}
        />
        <DocumentSlot
          employeeId={employeeId}
          employeePublicId={employeePublicId}
          docType="npwp"
          label="NPWP"
          hasFile={hasNpwp}
        />
        <DocumentSlot
          employeeId={employeeId}
          employeePublicId={employeePublicId}
          docType="marital"
          label={maritalDocLabel(maritalStatus)}
          hasFile={hasMaritalDocument}
        />
      </CardContent>
    </Card>
  )
}
