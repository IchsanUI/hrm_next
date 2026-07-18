import { prisma } from "@/lib/prisma"
import { Breadcrumb } from "@/components/breadcrumb"
import { WorkShiftsTable } from "@/components/work-shifts-table"
import { WorkShiftAdjustmentsTable } from "@/components/work-shift-adjustments-table"

export default async function JamKerjaPage() {
  const [workShifts, adjustments] = await Promise.all([
    prisma.workShift.findMany({ orderBy: { name: "asc" } }),
    prisma.workShiftAdjustment.findMany({
      include: { workShift: { select: { name: true } } },
      orderBy: { startDate: "desc" },
    }),
  ])

  return (
    <div className="grid gap-8">
      <div>
        <Breadcrumb
          items={[
            { label: "Dashboard", href: "/admin/dashboard" },
            { label: "Data Jam Kerja" },
          ]}
        />
        <h1 className="mb-6 text-2xl font-semibold">Data Jam Kerja</h1>
        <WorkShiftsTable workShifts={workShifts} />
      </div>
      <WorkShiftAdjustmentsTable
        adjustments={adjustments}
        workShifts={workShifts}
      />
    </div>
  )
}
