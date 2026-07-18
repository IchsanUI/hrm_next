"use client"

import { useActionState, useTransition } from "react"
import { toast } from "sonner"

import {
  addChildAction,
  deleteChildAction,
  type FamilyFormState,
} from "@/server/actions/employee-family"
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

type Child = {
  id: number
  fullName: string
  birthPlace: string | null
  birthDate: Date | null
}

export function EmployeeChildrenSection({
  employeeId,
  childrenList,
}: {
  employeeId: number
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
