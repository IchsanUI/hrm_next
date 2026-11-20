import Link from "next/link"
import { redirect } from "next/navigation"
import { Lock, UserPen } from "lucide-react"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { SELF_UPDATE_GROUPS, SELF_UPDATE_TEXT_FIELD_NAMES, parseSelfUpdateGroups } from "@/lib/self-update-fields"
import { Breadcrumb } from "@/components/breadcrumb"
import { EmployeeSelfUpdateForm } from "@/components/employee-self-update-form"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

// Update Data Mandiri — halaman terpisah dari Profil Saya. Hanya bisa dipakai
// saat admin membuka izin (Employee.allowSelfUpdate) dan hanya untuk grup
// data yang dipilih admin (lib/self-update-fields.ts).
export default async function UpdateDataPage() {
  const session = await auth()
  const employeeId = session?.user.employeeId
  if (!employeeId) redirect("/pegawai/dashboard")

  const employee = await prisma.employee.findUnique({ where: { id: employeeId } })
  if (!employee) redirect("/pegawai/dashboard")

  const groups = employee.allowSelfUpdate ? parseSelfUpdateGroups(employee.selfUpdateGroups) : []
  const openedLabel = employee.selfUpdateOpenedAt?.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })

  return (
    <div>
      <Breadcrumb
        items={[
          { label: "Dashboard", href: "/pegawai/dashboard" },
          { label: "Profil Saya", href: "/pegawai/profil" },
          { label: "Update Data" },
        ]}
      />
      <div className="mb-6 flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <UserPen className="size-5" />
        </span>
        <div>
          <h1 className="text-xl font-semibold sm:text-2xl">Update Data Mandiri</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {groups.length
              ? `Dibuka admin${openedLabel ? ` pada ${openedLabel}` : ""}: ${SELF_UPDATE_GROUPS.filter((g) => groups.includes(g.key))
                  .map((g) => g.label)
                  .join(", ")}. Data lain tetap dikelola HR.`
              : "Perbarui data pribadi Anda sendiri saat admin membuka izinnya."}
          </p>
        </div>
      </div>

      {groups.length ? (
        <EmployeeSelfUpdateForm
          groups={groups}
          fullName={employee.fullName}
          photoUrl={employee.photoUrl}
          initial={Object.fromEntries(SELF_UPDATE_TEXT_FIELD_NAMES.map((name) => [name, employee[name]]))}
          documents={{
            ktp: { label: "KTP", uploaded: !!employee.ktpFilePath },
            kk: { label: "Kartu Keluarga", uploaded: !!employee.kkFilePath },
            npwp: { label: "NPWP", uploaded: !!employee.npwpFilePath },
            // Label mengikuti status diri (sama seperti kartu Dokumen Pribadi admin).
            marital: {
              label: employee.maritalStatus === "DIVORCED" ? "Akta Cerai" : "Surat Nikah",
              uploaded: !!employee.maritalDocumentFilePath,
            },
          }}
        />
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-muted">
              <Lock className="size-5 text-muted-foreground" />
            </span>
            <div>
              <p className="font-medium">Izin update mandiri sedang tidak aktif</p>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                Untuk memperbarui data, hubungi HR agar membuka izin update mandiri untuk akun Anda. Anda akan mendapat
                notifikasi saat izin dibuka.
              </p>
            </div>
            <Button variant="outline" nativeButton={false} render={<Link href="/pegawai/profil" />}>
              Kembali ke Profil
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
