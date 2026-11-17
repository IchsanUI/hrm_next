import { notFound, redirect } from "next/navigation"

import { auth } from "@/auth"
import { isHealthClaimStaff } from "@/lib/health-claim"
import { HealthClaimMemoList } from "@/components/health-claim-memo-views"

export default async function PetugasNotaDinasListPage() {
  const session = await auth()
  const employeeId = session?.user.employeeId
  if (!employeeId) redirect("/login")
  if (!(await isHealthClaimStaff(employeeId, "PETUGAS"))) notFound()

  return (
    <HealthClaimMemoList
      basePath="/pegawai/pemeriksaan-klaim/nota-dinas"
      newHref="/pegawai/pemeriksaan-klaim/nota-dinas/baru"
      breadcrumbItems={[
        { label: "Dashboard", href: "/pegawai/dashboard" },
        { label: "Pemeriksaan Klaim", href: "/pegawai/pemeriksaan-klaim" },
        { label: "Nota Dinas" },
      ]}
    />
  )
}
