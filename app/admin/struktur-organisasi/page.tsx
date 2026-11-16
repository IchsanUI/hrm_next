import { prisma } from "@/lib/prisma"
import { buildOrgTree } from "@/lib/org-tree"
import { Breadcrumb } from "@/components/breadcrumb"
import { OrgChartTree } from "@/components/org-chart-tree"
import { OrgChartDiagram } from "@/components/org-chart-diagram"
import { Tabs, TabsList, TabsTrigger, TabsPanel } from "@/components/ui/tabs"
import { COMPANY_NAME } from "@/lib/reports/employee-report"
import { ListTree, Network } from "lucide-react"

export default async function StrukturOrganisasiPage() {
  const [employees, departments] = await Promise.all([
    prisma.employee.findMany({
      where: { isDeleted: false },
      select: {
        id: true,
        fullName: true,
        photoUrl: true,
        reportsToId: true,
        position: { select: { name: true } },
        department: { select: { name: true } },
      },
    }),
    prisma.department.findMany({ select: { headEmployeeId: true } }),
  ])

  const headEmployeeIds = new Set(
    departments
      .map((d) => d.headEmployeeId)
      .filter((id): id is number => id !== null)
  )

  const roots = buildOrgTree(
    employees.map((employee) => ({
      id: employee.id,
      fullName: employee.fullName,
      photoUrl: employee.photoUrl,
      positionName: employee.position.name,
      departmentName: employee.department.name,
      reportsToId: employee.reportsToId,
      isHead: headEmployeeIds.has(employee.id),
    }))
  )

  return (
    <div>
      <Breadcrumb
        items={[
          { label: "Dashboard", href: "/admin/dashboard" },
          { label: "Struktur Organisasi" },
        ]}
      />
      <h1 className="mb-6 text-2xl font-semibold">Struktur Organisasi</h1>
      <Tabs defaultValue="bagan">
        <TabsList>
          <TabsTrigger value="bagan">
            <Network className="size-4" />
            Bagan
          </TabsTrigger>
          <TabsTrigger value="daftar">
            <ListTree className="size-4" />
            Daftar
          </TabsTrigger>
        </TabsList>
        <TabsPanel value="bagan">
          <OrgChartDiagram roots={roots} title={COMPANY_NAME} />
        </TabsPanel>
        <TabsPanel value="daftar">
          <OrgChartTree roots={roots} />
        </TabsPanel>
      </Tabs>
    </div>
  )
}
