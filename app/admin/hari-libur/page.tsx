import { prisma } from "@/lib/prisma"
import { Breadcrumb } from "@/components/breadcrumb"
import { NationalHolidaysTable } from "@/components/national-holidays-table"

export default async function HariLiburPage() {
  const holidays = await prisma.nationalHoliday.findMany({
    orderBy: { date: "asc" },
  })

  return (
    <div>
      <Breadcrumb
        items={[
          { label: "Dashboard", href: "/admin/dashboard" },
          { label: "Hari Libur Nasional" },
        ]}
      />
      <h1 className="mb-6 text-2xl font-semibold">Hari Libur Nasional</h1>
      <NationalHolidaysTable holidays={holidays} />
    </div>
  )
}
