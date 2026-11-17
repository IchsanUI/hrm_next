import { notFound, redirect } from "next/navigation"

import { auth } from "@/auth"
import { isHealthClaimStaff } from "@/lib/health-claim"
import { HealthClaimDetailView } from "@/components/health-claim-detail-view"

export default async function PemeriksaanKlaimDetailPage({ params }: { params: Promise<{ publicId: string }> }) {
  const session = await auth()
  const user = session?.user
  if (!user?.employeeId) redirect("/login")
  if (!(await isHealthClaimStaff(user.employeeId, "PETUGAS"))) notFound()

  const { publicId } = await params
  const view = await HealthClaimDetailView({
    publicId,
    basePath: "/pegawai/pemeriksaan-klaim",
    breadcrumbItems: [
      { label: "Dashboard", href: "/pegawai/dashboard" },
      { label: "Pemeriksaan Klaim", href: "/pegawai/pemeriksaan-klaim" },
    ],
    viewer: user,
  })
  if (!view) notFound()
  return view
}
