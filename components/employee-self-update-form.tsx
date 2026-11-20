"use client"

import { useActionState, useEffect, useRef } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { CheckCircle2, FileUp, ImageUp, Pencil } from "lucide-react"

import {
  updateOwnProfileAction,
  uploadOwnDocumentAction,
  uploadOwnPhotoAction,
  type SelfDocType,
  type SelfUpdateFormState,
} from "@/server/actions/employee-self-update"
import { SELF_UPDATE_GROUPS, type SelfUpdateGroupKey, type SelfUpdateTextField } from "@/lib/self-update-fields"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

export type SelfUpdateInitialValues = Partial<Record<SelfUpdateTextField["name"], string | null>>

export type SelfUpdateDocuments = Record<SelfDocType, { label: string; uploaded: boolean }>

export const SELF_UPDATE_PAGE = "/pegawai/update-data"

// Pemberitahuan ringkas di Profil Saya — form lengkapnya ada di halaman
// terpisah (SELF_UPDATE_PAGE) supaya profil tetap rapi.
export function SelfUpdateNotice({ groups }: { groups: SelfUpdateGroupKey[] }) {
  const labels = SELF_UPDATE_GROUPS.filter((g) => groups.includes(g.key)).map((g) => g.label)
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm">
      <div className="min-w-0">
        <p className="font-medium">Izin update mandiri sedang aktif</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Admin membuka kesempatan memperbarui sendiri: {labels.join(", ")}.
        </p>
      </div>
      <Button size="sm" nativeButton={false} render={<Link href={SELF_UPDATE_PAGE} />}>
        <Pencil className="size-3.5" />
        Update Data Sekarang
      </Button>
    </div>
  )
}

// Halaman Update Data Mandiri — hanya grup yang dibuka admin
// (lib/self-update-fields.ts). Foto & dokumen langsung tersimpan saat
// diunggah; "Simpan & Selesai" menyimpan isian lalu mengunci izin lagi.
export function EmployeeSelfUpdateForm({
  groups,
  initial,
  fullName,
  photoUrl,
  documents,
}: {
  groups: SelfUpdateGroupKey[]
  initial: SelfUpdateInitialValues
  fullName: string
  photoUrl: string | null
  documents: SelfUpdateDocuments
}) {
  const router = useRouter()
  const [state, formAction, isPending] = useActionState<SelfUpdateFormState, FormData>(updateOwnProfileAction, undefined)

  const fieldGroups = SELF_UPDATE_GROUPS.filter((g) => g.kind === "fields" && groups.includes(g.key))
  const hasFiles = groups.includes("pasfoto") || groups.includes("dokumen")

  useEffect(() => {
    if (state?.error) toast.error(state.error)
    if (state?.success) {
      toast.success("Data berhasil diperbarui. Izin update mandiri otomatis dikunci lagi.")
      router.push("/pegawai/profil")
    }
  }, [state, router])

  const saveBar = (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-3">
        <Button type="submit" form="self-update-form" disabled={isPending}>
          {isPending ? "Menyimpan..." : fieldGroups.length ? "Simpan & Selesai" : "Selesai"}
        </Button>
        <Button variant="outline" nativeButton={false} render={<Link href="/pegawai/profil" />}>
          Kembali ke Profil
        </Button>
        <p className="text-xs text-muted-foreground">
          {hasFiles ? "Foto & dokumen langsung tersimpan saat diunggah. " : ""}
          Setelah selesai, izin update mandiri terkunci kembali dan HR mendapat ringkasan perubahan.
        </p>
      </CardContent>
    </Card>
  )

  return (
    <div className={hasFiles && fieldGroups.length ? "grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] xl:items-start" : "grid gap-6"}>
      {fieldGroups.length ? (
        <form id="self-update-form" action={formAction} className="grid gap-6">
          {fieldGroups.map((group) => (
            <Card key={group.key}>
              <CardHeader>
                <CardTitle className="text-base">{group.label}</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                {(group.fields as readonly SelfUpdateTextField[]).map((field) => (
                  <div key={field.name} className={`grid gap-2 ${field.multiline ? "sm:col-span-2" : ""}`}>
                    <Label htmlFor={`self-${field.name}`}>
                      {field.label}
                      {field.required ? <span className="text-destructive"> *</span> : null}
                    </Label>
                    {field.multiline ? (
                      <Textarea
                        id={`self-${field.name}`}
                        name={field.name}
                        defaultValue={initial[field.name] ?? ""}
                        maxLength={field.maxLength}
                        required={field.required}
                      />
                    ) : (
                      <Input
                        id={`self-${field.name}`}
                        name={field.name}
                        type={field.type ?? "text"}
                        defaultValue={initial[field.name] ?? ""}
                        maxLength={field.maxLength}
                        required={field.required}
                      />
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
          {state?.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          {saveBar}
        </form>
      ) : (
        // Hanya foto/dokumen yang dibuka — form kosong tetap dipakai untuk tombol Selesai.
        <form id="self-update-form" action={formAction} className="hidden" />
      )}

      {hasFiles ? (
        <div className="grid gap-6 xl:sticky xl:top-0">
          {groups.includes("pasfoto") ? <PhotoCard fullName={fullName} photoUrl={photoUrl} /> : null}
          {groups.includes("dokumen") ? <DocumentsCard documents={documents} /> : null}
          {!fieldGroups.length ? saveBar : null}
        </div>
      ) : null}
    </div>
  )
}

function PhotoCard({ fullName, photoUrl }: { fullName: string; photoUrl: string | null }) {
  const [state, formAction, isPending] = useActionState<SelfUpdateFormState, FormData>(uploadOwnPhotoAction, undefined)
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (state?.error) toast.error(state.error)
    if (state?.success) {
      toast.success("Pas foto diperbarui.")
      formRef.current?.reset()
    }
  }, [state])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Pas Foto</CardTitle>
        <CardDescription>Foto formal, latar polos, wajah terlihat jelas. JPG/PNG maks. 5 MB, otomatis dipotong persegi.</CardDescription>
      </CardHeader>
      <CardContent>
        <form ref={formRef} action={formAction} className="flex items-center gap-4">
          <Avatar className="size-20 shrink-0 rounded-full after:rounded-full">
            {photoUrl ? <AvatarImage src={photoUrl} className="rounded-full object-cover" /> : null}
            <AvatarFallback className="rounded-full">{fullName.slice(0, 1)}</AvatarFallback>
          </Avatar>
          <div className="grid min-w-0 flex-1 gap-2">
            <Input name="photo" type="file" accept="image/jpeg,image/png,image/webp" required />
            <Button type="submit" variant="outline" size="sm" disabled={isPending} className="w-fit">
              <ImageUp className="size-4" />
              {isPending ? "Mengunggah..." : "Unggah Foto"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

function DocumentsCard({ documents }: { documents: SelfUpdateDocuments }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Dokumen Identitas</CardTitle>
        <CardDescription>
          Scan/foto yang jelas dan terbaca. PDF, JPG, atau PNG maks. 5 MB. Mengunggah ulang akan mengganti file lama.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {(Object.keys(documents) as SelfDocType[]).map((type) => (
          <DocumentUpload key={type} type={type} label={documents[type].label} uploaded={documents[type].uploaded} />
        ))}
      </CardContent>
    </Card>
  )
}

function DocumentUpload({ type, label, uploaded }: { type: SelfDocType; label: string; uploaded: boolean }) {
  const [state, formAction, isPending] = useActionState<SelfUpdateFormState, FormData>(
    uploadOwnDocumentAction.bind(null, type),
    undefined
  )
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (state?.error) toast.error(state.error)
    if (state?.success) {
      toast.success(`${label} berhasil diunggah.`)
      formRef.current?.reset()
    }
  }, [state, label])

  return (
    <form ref={formRef} action={formAction} className="grid gap-2 rounded-lg border p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">{label}</p>
        {uploaded ? (
          <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="size-3.5" />
            Sudah ada
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">Belum ada</span>
        )}
      </div>
      <div className="flex gap-2">
        <Input name="file" type="file" accept="application/pdf,image/jpeg,image/png" required className="min-w-0" />
        <Button type="submit" size="sm" variant="outline" disabled={isPending} className="shrink-0">
          <FileUp className="size-4" />
          {isPending ? "..." : "Unggah"}
        </Button>
      </div>
    </form>
  )
}
