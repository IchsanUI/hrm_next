import Image from "next/image"
import type { Prisma } from "@prisma/client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export type ProfileEmployee = Prisma.EmployeeGetPayload<{
  include: {
    department: true
    position: true
    workLocation: true
    employmentStatus: true
  }
}>

const GENDER_LABEL: Record<string, string> = {
  MALE: "Laki-laki",
  FEMALE: "Perempuan",
}

function formatDate(date: Date) {
  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

export function EmployeeProfileView({ employee }: { employee: ProfileEmployee }) {
  const employmentFields: [string, string][] = [
    ["NIP", employee.employeeNumber],
    ["Jabatan", employee.position.name],
    ["Bagian", employee.department.name],
    ["Status Pekerjaan", employee.employmentStatus.name],
    ["Mulai Kerja", formatDate(employee.startDate)],
    ["Lokasi Kerja", employee.workLocation.name],
  ]

  const personalFields: [string, string][] = [
    ["Jenis Kelamin", GENDER_LABEL[employee.gender]],
    ["Tempat, Tanggal Lahir", `${employee.birthPlace}, ${formatDate(employee.birthDate)}`],
    ["NIK", employee.nik],
    ["Pendidikan Terakhir", employee.lastEducation || "-"],
  ]

  const addressFields: [string, string][] = [["Alamat Domisili", employee.address]]

  const contactFields: [string, string][] = [
    ["No HP", employee.phone],
    ["Email", employee.email],
  ]

  const sections: [string, [string, string][]][] = [
    ["Informasi Kepegawaian", employmentFields],
    ["Data Pribadi", personalFields],
    ["Alamat", addressFields],
    ["Kontak", contactFields],
  ]

  return (
    <div className="grid gap-6">
      <Card>
        <CardContent className="flex flex-col items-center gap-5 py-6 text-center sm:flex-row sm:items-center sm:text-left">
          {employee.photoUrl ? (
            <Image
              src={employee.photoUrl}
              alt={employee.fullName}
              width={96}
              height={96}
              className="size-24 shrink-0 rounded-full object-cover ring-2 ring-foreground/10"
            />
          ) : (
            <div className="flex size-24 shrink-0 items-center justify-center rounded-full bg-muted text-xs text-muted-foreground ring-2 ring-foreground/10">
              Tanpa Foto
            </div>
          )}
          <div className="flex-1">
            <p className="text-xl font-bold">{employee.fullName}</p>
            <p className="text-sm text-muted-foreground">
              {employee.position.name} &middot; {employee.department.name}
            </p>
            <p className="text-sm text-muted-foreground">NIP {employee.employeeNumber}</p>
          </div>
        </CardContent>
      </Card>

      {sections.map(([title, fields]) => (
        <Card key={title}>
          <CardHeader className="border-b">
            <CardTitle>{title}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-x-6 gap-y-4 pt-4 sm:grid-cols-2 lg:grid-cols-3">
            {fields.map(([label, value]) => (
              <div key={label} className="min-w-0">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-sm font-medium break-words">{value}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
