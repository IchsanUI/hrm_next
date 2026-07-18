import { prisma } from "@/lib/prisma"
import { Breadcrumb } from "@/components/breadcrumb"
import { WorkLocationsTable } from "@/components/work-locations-table"

export default async function LokasiKerjaPage() {
  const workLocations = await prisma.workLocation.findMany({
    orderBy: { name: "asc" },
  })

  return (
    <div>
      <Breadcrumb
        items={[
          { label: "Dashboard", href: "/admin/dashboard" },
          { label: "Data Lokasi Kerja" },
        ]}
      />
      <h1 className="mb-6 text-2xl font-semibold">Data Lokasi Kerja</h1>
      <WorkLocationsTable workLocations={workLocations} />
    </div>
  )
}
