import { notFound, redirect } from "next/navigation"

import { auth } from "@/auth"
import { HealthClaimDetailView } from "@/components/health-claim-detail-view"

export default async function AdminKlaimDetailPage({ params }: { params: Promise<{ publicId: string }> }) {
  const session = await auth()
  const user = session?.user
  const allowed =
    user?.role === "SUPER_ADMIN" || (user?.role === "HR_ADMIN" && user.menuAccess.includes("payroll.klaim-kesehatan"))
  if (!allowed) redirect("/admin/dashboard")

  const { publicId } = await params
  const view = await HealthClaimDetailView({
    publicId,
    basePath: "/admin/payroll/klaim-kesehatan",
    breadcrumbItems: [
      { label: "Dashboard", href: "/admin/dashboard" },
      { label: "Payroll" },
      { label: "Klaim Kesehatan", href: "/admin/payroll/klaim-kesehatan" },
    ],
    viewer: user,
    employeeHref: (id) => `/admin/pegawai/${id}/detail`,
  })
  if (!view) notFound()
  return view
}
