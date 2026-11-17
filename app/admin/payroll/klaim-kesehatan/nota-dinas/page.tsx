import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { HealthClaimMemoList } from "@/components/health-claim-memo-views"

export default async function AdminNotaDinasListPage() {
  const session = await auth()
  const user = session?.user
  const allowed =
    user?.role === "SUPER_ADMIN" || (user?.role === "HR_ADMIN" && user.menuAccess.includes("payroll.klaim-kesehatan"))
  if (!allowed) redirect("/admin/dashboard")

  return (
    <HealthClaimMemoList
      basePath="/admin/payroll/klaim-kesehatan/nota-dinas"
      breadcrumbItems={[
        { label: "Dashboard", href: "/admin/dashboard" },
        { label: "Payroll" },
        { label: "Klaim Kesehatan", href: "/admin/payroll/klaim-kesehatan" },
        { label: "Nota Dinas" },
      ]}
    />
  )
}
