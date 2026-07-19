"use client"

import { useActionState, useEffect, useState } from "react"
import { toast } from "sonner"
import { Pencil } from "lucide-react"

import {
  updateOwnProfileAction,
  type SelfUpdateFormState,
} from "@/server/actions/employee-self-update"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"

export type SelfUpdateInitialValues = {
  phone: string
  email: string
  address: string
  emergencyPhone: string | null
  instagram: string | null
  tiktok: string | null
  facebook: string | null
  ktpAddress: string | null
}

export function EmployeeSelfUpdateForm({ initial }: { initial: SelfUpdateInitialValues }) {
  const [editing, setEditing] = useState(false)
  const [state, formAction, isPending] = useActionState<SelfUpdateFormState, FormData>(
    updateOwnProfileAction,
    undefined
  )

  useEffect(() => {
    if (state?.error) {
      toast.error(state.error)
      return
    }
    if (state?.success) {
      toast.success(
        "Data berhasil diperbarui. Izin update mandiri Anda otomatis dikunci lagi — hubungi admin kalau perlu update lagi."
      )
      const id = setTimeout(() => setEditing(false), 0)
      return () => clearTimeout(id)
    }
  }, [state])

  if (!editing) {
    return (
      <div className="rounded-md border border-primary/20 bg-primary/5 p-3 text-sm">
        <p className="font-medium">Izin update mandiri sedang aktif</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Admin memberi Anda kesempatan memperbarui kontak &amp; alamat sendiri
          sekali. Setelah disimpan, izin ini otomatis terkunci lagi.
        </p>
        <Button size="sm" className="mt-3" onClick={() => setEditing(true)}>
          <Pencil className="size-3.5" />
          Update Data Sekarang
        </Button>
      </div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Update Kontak &amp; Alamat</CardTitle>
        <CardDescription>
          Cuma field di bawah ini yang bisa Anda ubah sendiri — data
          kepegawaian &amp; data pribadi lain tetap dikelola admin.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="phone">No HP</Label>
              <Input id="phone" name="phone" defaultValue={initial.phone} required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" defaultValue={initial.email} required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="emergencyPhone">No HP Urgent</Label>
              <Input
                id="emergencyPhone"
                name="emergencyPhone"
                defaultValue={initial.emergencyPhone ?? ""}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="instagram">Instagram</Label>
              <Input id="instagram" name="instagram" defaultValue={initial.instagram ?? ""} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="facebook">Facebook</Label>
              <Input id="facebook" name="facebook" defaultValue={initial.facebook ?? ""} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="tiktok">Tiktok</Label>
              <Input id="tiktok" name="tiktok" defaultValue={initial.tiktok ?? ""} />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="address">Alamat Domisili</Label>
            <Textarea id="address" name="address" defaultValue={initial.address} required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="ktpAddress">Alamat KTP</Label>
            <Textarea id="ktpAddress" name="ktpAddress" defaultValue={initial.ktpAddress ?? ""} />
          </div>

          {state?.error ? <p className="text-destructive text-sm">{state.error}</p> : null}
          <div className="flex gap-2">
            <Button type="submit" disabled={isPending}>
              {isPending ? "Menyimpan..." : "Simpan"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setEditing(false)}>
              Batal
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
