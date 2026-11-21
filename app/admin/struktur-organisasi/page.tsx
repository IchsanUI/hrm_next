import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { buildOrgTree, parseChildEmployeeIds } from "@/lib/org-tree"
import { Breadcrumb } from "@/components/breadcrumb"
import { OrgChartTree } from "@/components/org-chart-tree"
import { OrgChartDiagram } from "@/components/org-chart-diagram"
import { OrgExternalManager } from "@/components/org-external-manager"
import { Tabs, TabsList, TabsTrigger, TabsPanel } from "@/components/ui/tabs"
import { COMPANY_NAME } from "@/lib/reports/employee-report"
import { ListTree, Network } from "lucide-react"

export default async function StrukturOrganisasiPage() {
  const session = await auth()
  const user = session?.user
  const canManage =
    user?.role === "SUPER_ADMIN" ||
    (user?.role === "HR_ADMIN" && user.menuAccess.includes("kepegawaian.struktur-organisasi"))

  const [employees, departments, externalRows] = await Promise.all([
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
    prisma.orgExternalNode.findMany({ orderBy: [{ sortOrder: "asc" }, { id: "asc" }] }),
  ])

  const headEmployeeIds = new Set(
    departments
      .map((d) => d.headEmployeeId)
      .filter((id): id is number => id !== null)
  )
  const externals = externalRows.map((x) => ({
    id: x.id,
    name: x.name,
    title: x.title,
    organization: x.organization,
    parentExternalId: x.parentExternalId,
    parentEmployeeId: x.parentEmployeeId,
    childEmployeeIds: parseChildEmployeeIds(x.childEmployeeIds),
    sortOrder: x.sortOrder,
  }))
  const employeeIds = new Set(employees.map((e) => e.id))

  const roots = buildOrgTree(
    employees.map((employee) => ({
      id: employee.id,
      fullName: employee.fullName,
      photoUrl: employee.photoUrl,
      positionName: employee.position.name,
      departmentName: employee.department.name,
      reportsToId: employee.reportsToId,
      isHead: headEmployeeIds.has(employee.id),
    })),
    externals
  )

  return (
    <div>
      <Breadcrumb
        items={[
          { label: "Dashboard", href: "/admin/dashboard" },
          { label: "Struktur Organisasi" },
        ]}
      />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Struktur Organisasi</h1>
        {canManage ? (
          <OrgExternalManager
            externals={externals}
            employees={employees
              .map((e) => ({
                id: e.id,
                label: `${e.fullName} — ${e.position.name}`,
                hasSupervisor: e.reportsToId !== null && employeeIds.has(e.reportsToId),
              }))
              .sort((a, b) => a.label.localeCompare(b.label))}
          />
        ) : null}
      </div>
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
