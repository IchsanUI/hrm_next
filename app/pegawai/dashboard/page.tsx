import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export default async function EmployeeDashboardPage() {
  const session = await auth()
  const employee = session?.user.employeeId
    ? await prisma.employee.findUnique({
        where: { id: session.user.employeeId },
        include: { department: true, position: true },
      })
    : null

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">
        Selamat datang{employee ? `, ${employee.fullName}` : ""}
      </h1>
      {employee ? (
        <Card className="max-w-md">
          <CardHeader>
            <CardDescription>Ringkasan</CardDescription>
            <CardTitle>{employee.fullName}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-1 text-sm text-muted-foreground">
            <p>NIP: {employee.employeeNumber}</p>
            <p>Jabatan: {employee.position.name}</p>
            <p>Bagian: {employee.department.name}</p>
          </CardContent>
        </Card>
      ) : (
        <p className="text-muted-foreground">
          Akun Anda belum terhubung ke data pegawai. Hubungi admin.
        </p>
      )}
    </div>
  )
}
