import { auth } from "@/auth"
import { getFullEmployeeProfile } from "@/lib/employee-profile"
import { Breadcrumb } from "@/components/breadcrumb"
import { EmployeeProfileView } from "@/components/employee-profile-view"

export default async function AdminProfilePage() {
  const session = await auth()
  const employee = session?.user.employeeId
    ? await getFullEmployeeProfile(session.user.employeeId)
    : null

  return (
    <div>
      <Breadcrumb
        items={[
          { label: "Dashboard", href: "/admin/dashboard" },
          { label: "Profil Saya" },
        ]}
      />
      <h1 className="mb-6 text-2xl font-semibold">Profil Saya</h1>
      {employee ? (
        <EmployeeProfileView employee={employee} />
      ) : (
        <p className="text-muted-foreground">
          Akun ini adalah akun sistem (tidak terhubung ke data pegawai). Username:{" "}
          <span className="font-medium text-foreground">{session?.user.username}</span>
        </p>
      )}
    </div>
  )
}
