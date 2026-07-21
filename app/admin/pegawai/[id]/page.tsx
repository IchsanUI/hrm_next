import { notFound } from "next/navigation"

import { prisma } from "@/lib/prisma"
import { updateEmployeeAction } from "@/server/actions/employees"
import {
  uploadEmployeePhotoAction,
  uploadEmployeeSignatureAction,
  uploadEmployeeInitialsAction,
  uploadEmployeeFingerprintRightAction,
  uploadEmployeeFingerprintLeftAction,
} from "@/server/actions/employee-photo"
import { Breadcrumb } from "@/components/breadcrumb"
import { EmployeeForm } from "@/components/employee-form"
import { EmployeeImageUpload } from "@/components/employee-image-upload"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const WORK_SHIFT_TYPE_LABEL: Record<string, string> = {
  PEGAWAI: "Jam Pegawai",
  OUTSOURCING: "Jam Outsourcing",
}

function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10)
}

export default async function EditPegawaiPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: publicId } = await params

  const employee = await prisma.employee.findUnique({ where: { publicId } })

  if (!employee) {
    notFound()
  }

  const employeeId = employee.id

  const [departments, positions, workLocations, employmentStatuses, managers, workShifts] =
    await Promise.all([
      prisma.department.findMany({ orderBy: { name: "asc" } }),
      prisma.position.findMany({ orderBy: { name: "asc" } }),
      prisma.workLocation.findMany({ orderBy: { name: "asc" } }),
      prisma.employmentStatus.findMany({ orderBy: { name: "asc" } }),
      prisma.employee.findMany({
        where: { isDeleted: false, id: { not: employeeId } },
        select: { id: true, fullName: true, position: { select: { name: true } } },
        orderBy: { fullName: "asc" },
      }),
      prisma.workShift.findMany({ orderBy: { name: "asc" } }),
    ])

  return (
    <div>
      <Breadcrumb
        items={[
          { label: "Dashboard", href: "/admin/dashboard" },
          { label: "Data Pegawai", href: "/admin/pegawai" },
          { label: `Edit: ${employee.fullName}` },
        ]}
      />
      <h1 className="mb-6 text-2xl font-semibold">Edit Pegawai</h1>
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Foto & Dokumen Pegawai</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-5">
          <EmployeeImageUpload
            label="Foto Pegawai"
            fieldName="photo"
            action={uploadEmployeePhotoAction.bind(null, employeeId)}
            currentUrl={employee.photoUrl}
            width={100}
            height={100}
            imageClassName="size-[100px] rounded-md border object-cover"
            emptyLabel="Tanpa Foto"
          />
          <EmployeeImageUpload
            label="Tanda Tangan"
            fieldName="signature"
            action={uploadEmployeeSignatureAction.bind(null, employeeId)}
            currentUrl={employee.signatureUrl}
            width={100}
            height={100}
            imageClassName="h-[100px] w-[100px] rounded-md border object-contain bg-white"
            emptyLabel="Tanpa TTD"
          />
          <EmployeeImageUpload
            label="Paraf"
            fieldName="initials"
            action={uploadEmployeeInitialsAction.bind(null, employeeId)}
            currentUrl={employee.initialsUrl}
            width={100}
            height={100}
            imageClassName="h-[100px] w-[100px] rounded-md border object-contain bg-white"
            emptyLabel="Tanpa Paraf"
          />
          <EmployeeImageUpload
            label="Sidik Jari Kanan"
            fieldName="fingerprintRight"
            action={uploadEmployeeFingerprintRightAction.bind(null, employeeId)}
            currentUrl={employee.fingerprintRightUrl}
            width={100}
            height={100}
            imageClassName="size-[100px] rounded-md border object-cover"
            emptyLabel="Tanpa Sidik Jari"
          />
          <EmployeeImageUpload
            label="Sidik Jari Kiri"
            fieldName="fingerprintLeft"
            action={uploadEmployeeFingerprintLeftAction.bind(null, employeeId)}
            currentUrl={employee.fingerprintLeftUrl}
            width={100}
            height={100}
            imageClassName="size-[100px] rounded-md border object-cover"
            emptyLabel="Tanpa Sidik Jari"
          />
        </CardContent>
      </Card>
      <EmployeeForm
        action={updateEmployeeAction.bind(null, employeeId)}
        departments={departments}
        positions={positions}
        workLocations={workLocations}
        employmentStatuses={employmentStatuses}
        managers={managers.map((m) => ({
          id: m.id,
          name: `${m.fullName} — ${m.position.name}`,
        }))}
        workShifts={workShifts.map((s) => ({
          id: s.id,
          name: `${s.name} (${WORK_SHIFT_TYPE_LABEL[s.type]})`,
        }))}
        submitLabel="Simpan Perubahan"
        defaults={{
          employeeNumber: employee.employeeNumber,
          pinAttendance: employee.pinAttendance ?? undefined,
          fullName: employee.fullName,
          startDate: toDateInputValue(employee.startDate),
          departmentId: String(employee.departmentId),
          positionId: String(employee.positionId),
          workLocationId: String(employee.workLocationId),
          employmentStatusId: String(employee.employmentStatusId),
          reportsToId: employee.reportsToId ? String(employee.reportsToId) : undefined,
          workShiftId: employee.workShiftId ? String(employee.workShiftId) : undefined,
          birthDate: toDateInputValue(employee.birthDate),
          birthPlace: employee.birthPlace,
          gender: employee.gender,
          nik: employee.nik,
          address: employee.address,
          phone: employee.phone,
          email: employee.email,
          lastEducation: employee.lastEducation ?? undefined,
          major: employee.major ?? undefined,
          degree: employee.degree ?? undefined,
          rank: employee.rank ?? undefined,
          maritalStatus: employee.maritalStatus ?? undefined,
          exitLetterNumber: employee.exitLetterNumber ?? undefined,
          hobby: employee.hobby ?? undefined,
          emergencyPhone: employee.emergencyPhone ?? undefined,
          instagram: employee.instagram ?? undefined,
          tiktok: employee.tiktok ?? undefined,
          facebook: employee.facebook ?? undefined,
          ktpAddress: employee.ktpAddress ?? undefined,
          domicileKtp: employee.domicileKtp ?? undefined,
          motherName: employee.motherName ?? undefined,
          fatherName: employee.fatherName ?? undefined,
          illness: employee.illness ?? undefined,
          sideBusiness: employee.sideBusiness ?? undefined,
        }}
      />
    </div>
  )
}
