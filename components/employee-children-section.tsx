"use client"

import { useActionState, useEffect, useRef, useState, useTransition } from "react"
import { toast } from "sonner"

import {
  addChildAction,
  deleteChildAction,
  type FamilyFormState,
} from "@/server/actions/employee-family"
import {
  uploadChildBirthCertAction,
  type DocumentUploadState,
} from "@/server/actions/employee-documents"
import { useFormActionToast } from "@/lib/use-form-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"

type Child = {
  id: number
  fullName: string
  birthPlace: string | null
  birthDate: Date | null
  birthCertFilePath: string | null
}

function ChildBirthCertCell({
  child,
  employeeId,
  employeePublicId,
}: {
  child: Child
  employeeId: number
  employeePublicId: string
}) {
  const [open, setOpen] = useState(false)
  const action = uploadChildBirthCertAction.bind(null, child.id, employeeId)
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
      toast.success("Akta kelahiran berhasil diunggah.")
      formRef.current?.reset()
      setOpen(false)
    }
  }, [isPending, state])

  return (
    <div className="flex items-center gap-2">
      {child.birthCertFilePath ? (
        <a
          href={`/api/pegawai/${employeePublicId}/anak/${child.id}/akta`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-primary underline-offset-4 hover:underline"
        >
          Lihat
        </a>
      ) : (
        <span className="text-xs text-muted-foreground">-</span>
      )}
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        {child.birthCertFilePath ? "Ganti" : "Upload"}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Akta Kelahiran — {child.fullName}</DialogTitle>
            <DialogDescription>Format PDF, JPG, atau PNG. Maksimal 5MB.</DialogDescription>
          </DialogHeader>
          <form ref={formRef} action={formAction} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor={`akta-file-${child.id}`}>File</Label>
              <Input
                id={`akta-file-${child.id}`}
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

export function EmployeeChildrenSection({
  employeeId,
  employeePublicId,
  childrenList,
}: {
  employeeId: number
  employeePublicId: string
  childrenList: Child[]
}) {
  const [isPending, startTransition] = useTransition()
  const action = addChildAction.bind(null, employeeId)
  const [state, formAction, isSubmitting] = useActionState<
    FamilyFormState,
    FormData
  >(action, undefined)

  useFormActionToast(isSubmitting, state?.error, "Data anak berhasil ditambahkan.")

  return (
    <Card>
      <CardHeader>
        <CardTitle>Data Anak Pegawai</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        {childrenList.length ? (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama</TableHead>
                  <TableHead>Tempat/Tanggal Lahir</TableHead>
                  <TableHead>Akta Kelahiran</TableHead>
                  <TableHead className="w-24">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {childrenList.map((child) => (
                  <TableRow key={child.id}>
                    <TableCell>{child.fullName}</TableCell>
                    <TableCell>
                      {child.birthPlace || "-"}
                      {child.birthDate
                        ? `, ${child.birthDate.toLocaleDateString("id-ID")}`
                        : ""}
                    </TableCell>
                    <TableCell>
                      <ChildBirthCertCell
                        child={child}
                        employeeId={employeeId}
                        employeePublicId={employeePublicId}
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={isPending}
                        onClick={() =>
                          startTransition(async () => {
                            try {
                              await deleteChildAction(child.id, employeeId)
                              toast.success("Data anak berhasil dihapus.")
                            } catch {
                              toast.error("Gagal menghapus data anak.")
                            }
                          })
                        }
                      >
                        Hapus
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Belum ada data anak.</p>
        )}

        <form action={formAction} className="grid gap-4 sm:grid-cols-3">
          <div className="grid gap-2">
            <Label htmlFor="child-fullName">Nama Anak</Label>
            <Input id="child-fullName" name="fullName" required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="child-birthPlace">Tempat Lahir</Label>
            <Input id="child-birthPlace" name="birthPlace" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="child-birthDate">Tanggal Lahir</Label>
            <Input id="child-birthDate" name="birthDate" type="date" />
          </div>
          {state?.error ? (
            <p className="text-destructive text-sm sm:col-span-3">
              {state.error}
            </p>
          ) : null}
          <div className="sm:col-span-3">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Menambah..." : "Tambah Anak"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
