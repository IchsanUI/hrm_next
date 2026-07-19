import { auth } from "@/auth"
import { getFullEmployeeProfile } from "@/lib/employee-profile"
import { EmployeeProfileView } from "@/components/employee-profile-view"

export default async function EmployeeProfilePage() {
  const session = await auth()
  const employee = session?.user.employeeId
    ? await getFullEmployeeProfile(session.user.employeeId)
    : null

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">Profil Saya</h1>
      {employee ? (
        <EmployeeProfileView employee={employee} />
      ) : (
        <p className="text-muted-foreground">
          Akun Anda belum terhubung ke data pegawai. Hubungi admin.
        </p>
      )}
    </div>
  )
}
