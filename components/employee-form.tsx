"use client"

import { useActionState, useEffect, useRef, useState, useTransition } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { Check, Copy, Sparkles } from "lucide-react"

import { generateEmployeeNumberAction, type EmployeeFormState } from "@/server/actions/employees"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

type CreatedCredentials = NonNullable<NonNullable<EmployeeFormState>["success"]>

function EmployeeCreatedSuccess({ success }: { success: CreatedCredentials }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(success.password)
    setCopied(true)
    toast.success("Password disalin ke clipboard.")
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Card className="border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30">
      <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
          <Check className="size-6" />
        </div>
        <div>
          <p className="text-lg font-semibold text-emerald-900 dark:text-emerald-100">
            Pegawai Berhasil Ditambahkan
          </p>
          <p className="mt-1 text-sm text-emerald-800 dark:text-emerald-200">
            Akun untuk <span className="font-semibold">{success.fullName}</span> sudah
            dibuat. Berikan kredensial berikut untuk login pertama kali.
          </p>
        </div>

        <div className="w-full max-w-sm rounded-lg border bg-card p-4 text-left">
          <div className="grid gap-3">
            <div>
              <p className="text-xs text-muted-foreground">Username (NIP)</p>
              <p className="font-mono text-sm font-medium">{success.username}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Password Sementara</p>
              <div className="mt-1 flex items-center gap-2">
                <code className="flex-1 rounded-md bg-muted px-3 py-2 font-mono text-sm">
                  {success.password}
                </code>
                <Button type="button" variant="outline" size="icon" onClick={handleCopy}>
                  {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                </Button>
              </div>
            </div>
          </div>
        </div>

        <p className="max-w-sm text-xs text-emerald-800 dark:text-emerald-200">
          Password ini hanya ditampilkan sekali. Catat atau salin sekarang sebelum
          meninggalkan halaman ini.
        </p>

        <div className="flex gap-2">
          <Button
            variant="outline"
            render={<Link href="/admin/pegawai" />}
            nativeButton={false}
          >
            Kembali ke Daftar
          </Button>
          <Button
            render={<Link href={`/admin/pegawai/${success.employeePublicId}/detail`} />}
            nativeButton={false}
          >
            Lihat Detail Pegawai
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

type Option = { id: number; name: string }

export type EmployeeFormDefaults = {
  employeeNumber?: string
  pinAttendance?: string
  fullName?: string
  startDate?: string
  resignDate?: string
  departmentId?: string
  positionId?: string
  workLocationId?: string
  employmentStatusId?: string
  reportsToId?: string
  workShiftId?: string
  birthDate?: string
  birthPlace?: string
  gender?: string
  nik?: string
  address?: string
  phone?: string
  email?: string
  lastEducation?: string
  major?: string
  degree?: string
  salaryGradeId?: string
  salaryGradeStep?: string
  npwp?: string
  ptkpStatus?: string
  maritalStatus?: string
  exitLetterNumber?: string
  hobby?: string
  emergencyPhone?: string
  instagram?: string
  tiktok?: string
  facebook?: string
  ktpAddress?: string
  domicileKtp?: string
  motherName?: string
  fatherName?: string
  illness?: string
  sideBusiness?: string
}

export function EmployeeForm({
  action,
  departments,
  positions,
  workLocations,
  employmentStatuses,
  managers,
  workShifts,
  salaryGrades,
  defaults,
  submitLabel,
  mode = "edit",
}: {
  action: (state: EmployeeFormState, formData: FormData) => Promise<EmployeeFormState>
  departments: Option[]
  positions: Option[]
  workLocations: Option[]
  employmentStatuses: Option[]
  managers: Option[]
  workShifts: Option[]
  salaryGrades: Option[]
  defaults?: EmployeeFormDefaults
  submitLabel: string
  // "create" — cuma tampilkan kolom wajib (Data Kepegawaian) & Data Pribadi
  // (isinya memang semua wajib); kartu Data Tambahan (semua kolomnya
  // opsional) disembunyikan total, dilengkapi belakangan lewat Edit setelah
  // pegawainya ada. "edit" (default) — tampilkan semua kolom seperti biasa.
  mode?: "create" | "edit"
}) {
  const [state, formAction, isPending] = useActionState(action, undefined)
  const isCreate = mode === "create"

  const formRef = useRef<HTMLFormElement>(null)
  const [employeeNumber, setEmployeeNumber] = useState(defaults?.employeeNumber ?? "")
  const [isGeneratingNumber, startGenerateTransition] = useTransition()
  const [fullName, setFullName] = useState((defaults?.fullName ?? "").toUpperCase())
  const [confirmSaveOpen, setConfirmSaveOpen] = useState(false)

  function handleSubmitClick(event: React.MouseEvent<HTMLButtonElement>) {
    // Mode create — jangan langsung submit, tampilkan konfirmasi dulu (data
    // pegawai baru tidak semudah itu dibatalkan lagi setelah tersimpan,
    // mis. sudah dipakai di periode payroll/absensi). Mode edit tetap submit
    // langsung seperti biasa.
    if (isCreate) {
      event.preventDefault()
      setConfirmSaveOpen(true)
    }
  }

  // Ambil Status Kepegawaian/Mulai Kerja/Tanggal Lahir yang SEDANG diisi user
  // (belum di-submit) langsung dari FormData form ini — field-field itu
  // sendiri tetap uncontrolled (Select/Input defaultValue biasa), jadi tidak
  // perlu diubah jadi controlled cuma buat fitur generate ini.
  function handleGenerateEmployeeNumber() {
    if (!formRef.current) return
    const formData = new FormData(formRef.current)
    startGenerateTransition(async () => {
      const result = await generateEmployeeNumberAction(undefined, formData)
      if (result?.error) {
        toast.error(result.error)
      } else if (result?.employeeNumber) {
        setEmployeeNumber(result.employeeNumber)
        toast.success(`NIP digenerate: ${result.employeeNumber}`)
      }
    })
  }

  useEffect(() => {
    if (state?.error) {
      toast.error(state.error)
    }
  }, [state])

  const fieldError = (name: string) => state?.fieldErrors?.[name]?.[0]

  if (state?.success) {
    return <EmployeeCreatedSuccess success={state.success} />
  }

  return (
    <form ref={formRef} action={formAction} className="grid gap-6">
      <p className="text-sm text-muted-foreground">
        Kolom bertanda <span className="text-destructive">*</span> wajib diisi, kolom
        lainnya opsional dan bisa dilengkapi kemudian.
      </p>
      {state?.error ? (
        <p className="text-destructive text-sm">{state.error}</p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Data Kepegawaian</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className={isCreate ? "sm:col-span-2" : undefined}>
            <Field label="NIP" name="employeeNumber" error={fieldError("employeeNumber")} required>
              {isCreate ? (
                <div className="flex items-center gap-2">
                  <Input
                    id="employeeNumber"
                    name="employeeNumber"
                    value={employeeNumber}
                    onChange={(e) => setEmployeeNumber(e.target.value)}
                    placeholder="Isi manual atau klik Generate Otomatis"
                    className="max-w-xs"
                    required
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="shrink-0"
                    disabled={isGeneratingNumber}
                    onClick={handleGenerateEmployeeNumber}
                  >
                    <Sparkles className="size-3.5" />
                    {isGeneratingNumber ? "Generate..." : "Generate Otomatis"}
                  </Button>
                </div>
              ) : (
                <Input
                  id="employeeNumber"
                  name="employeeNumber"
                  defaultValue={defaults?.employeeNumber}
                  required
                />
              )}
              {isCreate ? (
                <p className="text-xs text-muted-foreground">
                  Otomatis: [huruf status][2 digit tahun masuk][tgl+bulan+tahun lahir][3 digit urutan] —
                  isi dulu Status Kepegawaian, Mulai Kerja &amp; Tanggal Lahir di bawah sebelum
                  klik Generate. Hasilnya tetap bisa diedit manual.
                </p>
              ) : null}
            </Field>
          </div>
          {!isCreate ? (
            <Field
              label="PIN Mesin Absensi"
              name="pinAttendance"
              error={fieldError("pinAttendance")}
            >
              <Input
                id="pinAttendance"
                name="pinAttendance"
                placeholder="mis. 144 — lihat di menu Absensi > Data Absensi"
                defaultValue={defaults?.pinAttendance}
              />
            </Field>
          ) : null}
          <Field label="Nama Lengkap" name="fullName" error={fieldError("fullName")} required>
            <Input
              id="fullName"
              name="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value.toUpperCase())}
              className="uppercase placeholder:normal-case"
              required
            />
          </Field>
          <Field label="Mulai Kerja" name="startDate" error={fieldError("startDate")} required>
            <Input
              id="startDate"
              name="startDate"
              type="date"
              defaultValue={defaults?.startDate}
              required
            />
          </Field>
          {!isCreate ? (
            <Field
              label="Tanggal Resign/Pensiun"
              name="resignDate"
              error={fieldError("resignDate")}
              hint="Isi lebih awal kalau sudah tahu tanggalnya (mis. masih masa notice, pegawai tetap aktif seperti biasa) — periode payroll yang mengandung tanggal ini otomatis direkonsiliasi pakai tarif progresif Pasal 17 (bukan TER lagi), sesuai PP 58/2023. Tanggal ini otomatis terisi lagi saat pegawai dinonaktifkan lewat tombol Hapus di Data Pegawai."
            >
              <Input
                id="resignDate"
                name="resignDate"
                type="date"
                defaultValue={defaults?.resignDate}
              />
            </Field>
          ) : null}
          <Field label="Bagian" name="departmentId" error={fieldError("departmentId")} required>
            <SelectField
              name="departmentId"
              options={departments}
              defaultValue={defaults?.departmentId}
            />
          </Field>
          <Field label="Jabatan" name="positionId" error={fieldError("positionId")} required>
            <SelectField
              name="positionId"
              options={positions}
              defaultValue={defaults?.positionId}
            />
          </Field>
          <Field
            label="Lokasi Kerja"
            name="workLocationId"
            error={fieldError("workLocationId")}
            required
          >
            <SelectField
              name="workLocationId"
              options={workLocations}
              defaultValue={defaults?.workLocationId}
            />
          </Field>
          <Field
            label="Status Kepegawaian"
            name="employmentStatusId"
            error={fieldError("employmentStatusId")}
            required
          >
            <SelectField
              name="employmentStatusId"
              options={employmentStatuses}
              defaultValue={defaults?.employmentStatusId}
            />
          </Field>
          {!isCreate ? (
            <Field
              label="Melapor Kepada (Atasan Langsung)"
              name="reportsToId"
              error={fieldError("reportsToId")}
            >
              <SelectField
                name="reportsToId"
                options={managers}
                defaultValue={defaults?.reportsToId}
              />
            </Field>
          ) : null}
          {!isCreate ? (
            <Field label="Jam Kerja" name="workShiftId" error={fieldError("workShiftId")}>
              <SelectField
                name="workShiftId"
                options={workShifts}
                defaultValue={defaults?.workShiftId}
              />
            </Field>
          ) : null}
          {!isCreate ? (
            <Field
              label="Golongan"
              name="salaryGradeId"
              error={fieldError("salaryGradeId")}
            >
              <SelectField
                name="salaryGradeId"
                options={salaryGrades}
                defaultValue={defaults?.salaryGradeId}
              />
            </Field>
          ) : null}
          {!isCreate ? (
            <Field
              label="Step Masa Kerja"
              name="salaryGradeStep"
              error={fieldError("salaryGradeStep")}
            >
              <Input
                id="salaryGradeStep"
                name="salaryGradeStep"
                type="number"
                min={0}
                defaultValue={defaults?.salaryGradeStep}
              />
            </Field>
          ) : null}
          {!isCreate ? (
            <Field
              label="Pendidikan Terakhir"
              name="lastEducation"
              error={fieldError("lastEducation")}
            >
              <Input
                id="lastEducation"
                name="lastEducation"
                defaultValue={defaults?.lastEducation}
              />
            </Field>
          ) : null}
          {!isCreate ? (
            <Field label="Jurusan" name="major" error={fieldError("major")}>
              <Input id="major" name="major" defaultValue={defaults?.major} />
            </Field>
          ) : null}
          {!isCreate ? (
            <Field label="Gelar" name="degree" error={fieldError("degree")}>
              <Input id="degree" name="degree" defaultValue={defaults?.degree} />
            </Field>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Data Pribadi</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Tanggal Lahir" name="birthDate" error={fieldError("birthDate")} required>
            <Input
              id="birthDate"
              name="birthDate"
              type="date"
              defaultValue={defaults?.birthDate}
              required
            />
          </Field>
          <Field label="Tempat Lahir" name="birthPlace" error={fieldError("birthPlace")} required>
            <Input
              id="birthPlace"
              name="birthPlace"
              defaultValue={defaults?.birthPlace}
              required
            />
          </Field>
          <Field label="Jenis Kelamin" name="gender" error={fieldError("gender")} required>
            <SelectField
              name="gender"
              options={[
                { id: "MALE", name: "Laki-laki" },
                { id: "FEMALE", name: "Perempuan" },
              ]}
              defaultValue={defaults?.gender}
            />
          </Field>
          <Field label="NIK" name="nik" error={fieldError("nik")} required>
            <Input id="nik" name="nik" defaultValue={defaults?.nik} required />
          </Field>
          <Field label="No. HP" name="phone" error={fieldError("phone")} required>
            <Input id="phone" name="phone" defaultValue={defaults?.phone} required />
          </Field>
          <Field label="Email" name="email" error={fieldError("email")} required>
            <Input
              id="email"
              name="email"
              type="email"
              defaultValue={defaults?.email}
              required
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Alamat" name="address" error={fieldError("address")} required>
              <Input
                id="address"
                name="address"
                defaultValue={defaults?.address}
                required
              />
            </Field>
          </div>
        </CardContent>
      </Card>

      {isCreate ? (
        <p className="text-sm text-muted-foreground">
          Data tambahan (status diri, NPWP, kontak darurat, media sosial, alamat KTP, dst) bisa
          dilengkapi belakangan lewat menu Edit setelah pegawai ini tersimpan.
        </p>
      ) : (
      <Card>
        <CardHeader>
          <CardTitle>Data Tambahan</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Status Diri"
            name="maritalStatus"
            error={fieldError("maritalStatus")}
          >
            <SelectField
              name="maritalStatus"
              options={[
                { id: "SINGLE", name: "Belum Menikah" },
                { id: "MARRIED", name: "Menikah" },
                { id: "DIVORCED", name: "Cerai" },
                { id: "WIDOWED", name: "Janda/Duda" },
              ]}
              defaultValue={defaults?.maritalStatus}
            />
          </Field>
          <Field label="NPWP" name="npwp" error={fieldError("npwp")}>
            <Input id="npwp" name="npwp" defaultValue={defaults?.npwp} />
          </Field>
          <Field
            label="Status PTKP"
            name="ptkpStatus"
            error={fieldError("ptkpStatus")}
          >
            <SelectField
              name="ptkpStatus"
              options={[
                { id: "TK0", name: "TK/0 — Tidak Kawin, 0 Tanggungan" },
                { id: "TK1", name: "TK/1 — Tidak Kawin, 1 Tanggungan" },
                { id: "TK2", name: "TK/2 — Tidak Kawin, 2 Tanggungan" },
                { id: "TK3", name: "TK/3 — Tidak Kawin, 3 Tanggungan" },
                { id: "K0", name: "K/0 — Kawin, 0 Tanggungan" },
                { id: "K1", name: "K/1 — Kawin, 1 Tanggungan" },
                { id: "K2", name: "K/2 — Kawin, 2 Tanggungan" },
                { id: "K3", name: "K/3 — Kawin, 3 Tanggungan" },
              ]}
              defaultValue={defaults?.ptkpStatus}
            />
          </Field>
          <Field label="Hobi" name="hobby" error={fieldError("hobby")}>
            <Input id="hobby" name="hobby" defaultValue={defaults?.hobby} />
          </Field>
          <Field
            label="No. HP Urgent"
            name="emergencyPhone"
            error={fieldError("emergencyPhone")}
          >
            <Input
              id="emergencyPhone"
              name="emergencyPhone"
              defaultValue={defaults?.emergencyPhone}
            />
          </Field>
          <Field
            label="Surat Keluar"
            name="exitLetterNumber"
            error={fieldError("exitLetterNumber")}
          >
            <Input
              id="exitLetterNumber"
              name="exitLetterNumber"
              defaultValue={defaults?.exitLetterNumber}
            />
          </Field>
          <Field label="Instagram" name="instagram" error={fieldError("instagram")}>
            <Input
              id="instagram"
              name="instagram"
              defaultValue={defaults?.instagram}
            />
          </Field>
          <Field label="Tiktok" name="tiktok" error={fieldError("tiktok")}>
            <Input id="tiktok" name="tiktok" defaultValue={defaults?.tiktok} />
          </Field>
          <Field label="Facebook" name="facebook" error={fieldError("facebook")}>
            <Input
              id="facebook"
              name="facebook"
              defaultValue={defaults?.facebook}
            />
          </Field>
          <Field
            label="Nama Ayah Kandung"
            name="fatherName"
            error={fieldError("fatherName")}
          >
            <Input
              id="fatherName"
              name="fatherName"
              defaultValue={defaults?.fatherName}
            />
          </Field>
          <Field
            label="Nama Ibu Kandung"
            name="motherName"
            error={fieldError("motherName")}
          >
            <Input
              id="motherName"
              name="motherName"
              defaultValue={defaults?.motherName}
            />
          </Field>
          <div className="sm:col-span-2">
            <Field
              label="Alamat KTP"
              name="ktpAddress"
              error={fieldError("ktpAddress")}
            >
              <Textarea
                id="ktpAddress"
                name="ktpAddress"
                defaultValue={defaults?.ktpAddress}
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field
              label="Domisili KTP"
              name="domicileKtp"
              error={fieldError("domicileKtp")}
            >
              <Textarea
                id="domicileKtp"
                name="domicileKtp"
                defaultValue={defaults?.domicileKtp}
              />
            </Field>
          </div>
          <Field
            label="Penyakit Bawaan"
            name="illness"
            error={fieldError("illness")}
          >
            <Input id="illness" name="illness" defaultValue={defaults?.illness} />
          </Field>
          <Field
            label="Usaha yang Dimiliki di Luar Pekerjaan"
            name="sideBusiness"
            error={fieldError("sideBusiness")}
          >
            <Input
              id="sideBusiness"
              name="sideBusiness"
              defaultValue={defaults?.sideBusiness}
            />
          </Field>
        </CardContent>
      </Card>
      )}

      <div>
        <Button type="submit" disabled={isPending} onClick={handleSubmitClick}>
          {isPending ? "Menyimpan..." : submitLabel}
        </Button>
      </div>

      {isCreate ? (
        <AlertDialog open={confirmSaveOpen} onOpenChange={setConfirmSaveOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Periksa lagi data pegawai ini?</AlertDialogTitle>
              <AlertDialogDescription>
                Pastikan NIP, nama, dan data lain sudah benar sebelum disimpan — data pegawai
                yang sudah tersimpan tidak bisa dihapus begitu saja kalau ternyata salah input
                (harus lewat proses nonaktifkan/hapus terpisah). Lanjutkan simpan?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Periksa Lagi</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  setConfirmSaveOpen(false)
                  formRef.current?.requestSubmit()
                }}
              >
                Ya, Simpan
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
    </form>
  )
}

function Field({
  label,
  error,
  required,
  hint,
  children,
}: {
  label: string
  name: string
  error?: string
  required?: boolean
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="grid gap-2">
      <Label>
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
    </div>
  )
}

function SelectField({
  name,
  options,
  defaultValue,
}: {
  name: string
  options: { id: string | number; name: string }[]
  defaultValue?: string
}) {
  const items = options.map((option) => ({
    value: String(option.id),
    label: option.name,
  }))

  return (
    <Select name={name} defaultValue={defaultValue} items={items}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Pilih" />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.id} value={String(option.id)}>
            {option.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
