import { notFound, redirect } from "next/navigation"

import { auth } from "@/auth"
import { isHealthClaimStaff } from "@/lib/health-claim"
import { HealthClaimMemoDetail } from "@/components/health-claim-memo-views"

export default async function PembayaranKlaimDetailPage({ params }: { params: Promise<{ publicId: string }> }) {
  const session = await auth()
  const user = session?.user
  if (!user?.employeeId) redirect("/login")
  if (!(await isHealthClaimStaff(user.employeeId, "ACCOUNTING"))) notFound()

  const { publicId } = await params
  const view = await HealthClaimMemoDetail({
    publicId,
    viewer: user,
    breadcrumbItems: [
      { label: "Dashboard", href: "/pegawai/dashboard" },
      { label: "Pembayaran Klaim", href: "/pegawai/pembayaran-klaim" },
    ],
  })
  if (!view) notFound()
  return view
}
