import { prisma } from "@/lib/prisma"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export default async function AdminDashboardPage() {
  const [employeeCount, departmentCount, positionCount] = await Promise.all([
    prisma.employee.count({ where: { isDeleted: false } }),
    prisma.department.count(),
    prisma.position.count(),
  ])

  const stats = [
    { label: "Total Pegawai Aktif", value: employeeCount },
    { label: "Total Bagian", value: departmentCount },
    { label: "Total Jabatan", value: positionCount },
  ]

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">Dashboard Admin</h1>
      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader>
              <CardDescription>{stat.label}</CardDescription>
              <CardTitle className="text-3xl">{stat.value}</CardTitle>
            </CardHeader>
            <CardContent />
          </Card>
        ))}
      </div>
    </div>
  )
}
