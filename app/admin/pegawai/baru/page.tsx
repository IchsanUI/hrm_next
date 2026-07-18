import { prisma } from "@/lib/prisma"
import { createEmployeeAction } from "@/server/actions/employees"
import { Breadcrumb } from "@/components/breadcrumb"
import { EmployeeForm } from "@/components/employee-form"

const WORK_SHIFT_TYPE_LABEL: Record<string, string> = {
  PEGAWAI: "Jam Pegawai",
  OUTSOURCING: "Jam Outsourcing",
}

export default async function NewPegawaiPage() {
  const [departments, positions, workLocations, employmentStatuses, managers, workShifts] =
    await Promise.all([
      prisma.department.findMany({ orderBy: { name: "asc" } }),
      prisma.position.findMany({ orderBy: { name: "asc" } }),
      prisma.workLocation.findMany({ orderBy: { name: "asc" } }),
      prisma.employmentStatus.findMany({ orderBy: { name: "asc" } }),
      prisma.employee.findMany({
        where: { isDeleted: false },
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
          { label: "Tambah Pegawai" },
        ]}
      />
      <h1 className="mb-6 text-2xl font-semibold">Tambah Pegawai</h1>
      <EmployeeForm
        action={createEmployeeAction}
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
        submitLabel="Simpan Pegawai"
      />
    </div>
  )
}
