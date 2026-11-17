import { notFound, redirect } from "next/navigation"

import { auth } from "@/auth"
import { HealthClaimMemoDetail } from "@/components/health-claim-memo-views"

export default async function AdminNotaDinasDetailPage({ params }: { params: Promise<{ publicId: string }> }) {
  const session = await auth()
  const user = session?.user
  const allowed =
    user?.role === "SUPER_ADMIN" || (user?.role === "HR_ADMIN" && user.menuAccess.includes("payroll.klaim-kesehatan"))
  if (!allowed) redirect("/admin/dashboard")

  const { publicId } = await params
  const view = await HealthClaimMemoDetail({
    publicId,
    viewer: user,
    breadcrumbItems: [
      { label: "Dashboard", href: "/admin/dashboard" },
      { label: "Payroll" },
      { label: "Klaim Kesehatan", href: "/admin/payroll/klaim-kesehatan" },
      { label: "Nota Dinas", href: "/admin/payroll/klaim-kesehatan/nota-dinas" },
    ],
    claimHref: (id) => `/admin/payroll/klaim-kesehatan/${id}`,
  })
  if (!view) notFound()
  return view
}
