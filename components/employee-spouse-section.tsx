"use client"

import { useActionState, useState, useTransition } from "react"
import { toast } from "sonner"

import {
  saveSpouseAction,
  deleteSpouseAction,
  type FamilyFormState,
} from "@/server/actions/employee-family"
import { useFormActionToast } from "@/lib/use-form-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type Spouse = {
  fullName: string
  occupation: string | null
  birthPlace: string | null
  birthDate: Date | null
}

function toDateInputValue(date: Date | null) {
  return date ? date.toISOString().slice(0, 10) : ""
}

export function EmployeeSpouseSection({
  employeeId,
  spouse,
}: {
  employeeId: number
  spouse: Spouse | null
}) {
  const [editing, setEditing] = useState(!spouse)
  const action = saveSpouseAction.bind(null, employeeId)
  const [state, formAction, isPending] = useActionState<FamilyFormState, FormData>(
    action,
    undefined
  )
  const [isDeleting, startDeleteTransition] = useTransition()

  useFormActionToast(isPending, state?.error, "Data keluarga berhasil disimpan.")

  function handleDelete() {
    startDeleteTransition(async () => {
      try {
        await deleteSpouseAction(employeeId)
        toast.success("Data keluarga berhasil dihapus.")
      } catch {
        toast.error("Gagal menghapus data keluarga.")
      }
    })
  }

  if (!editing && spouse) {
    return (
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Data Keluarga</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              Edit
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={isDeleting}
              onClick={handleDelete}
            >
              Hapus
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground">Nama Suami/Istri</p>
            <p className="text-sm font-medium">{spouse.fullName}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Tempat/Tanggal Lahir</p>
            <p className="text-sm font-medium">
              {spouse.birthPlace || "-"}
              {spouse.birthDate
                ? `, ${spouse.birthDate.toLocaleDateString("id-ID")}`
                : ""}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Pekerjaan</p>
            <p className="text-sm font-medium">{spouse.occupation || "-"}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Data Keluarga</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          action={async (formData) => {
            await formAction(formData)
            setEditing(false)
          }}
          className="grid gap-4 sm:grid-cols-2"
        >
          <div className="grid gap-2">
            <Label htmlFor="spouse-fullName">Nama Suami/Istri</Label>
            <Input
              id="spouse-fullName"
              name="fullName"
              defaultValue={spouse?.fullName}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="spouse-occupation">Pekerjaan</Label>
            <Input
              id="spouse-occupation"
              name="occupation"
              defaultValue={spouse?.occupation ?? undefined}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="spouse-birthPlace">Tempat Lahir</Label>
            <Input
              id="spouse-birthPlace"
              name="birthPlace"
              defaultValue={spouse?.birthPlace ?? undefined}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="spouse-birthDate">Tanggal Lahir</Label>
            <Input
              id="spouse-birthDate"
              name="birthDate"
              type="date"
              defaultValue={toDateInputValue(spouse?.birthDate ?? null)}
            />
          </div>
          {state?.error ? (
            <p className="text-destructive text-sm sm:col-span-2">
              {state.error}
            </p>
          ) : null}
          <div className="flex gap-2 sm:col-span-2">
            <Button type="submit" disabled={isPending}>
              {isPending ? "Menyimpan..." : "Simpan"}
            </Button>
            {spouse ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditing(false)}
              >
                Batal
              </Button>
            ) : null}
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
