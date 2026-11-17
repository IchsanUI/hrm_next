import { notFound, redirect } from "next/navigation"

import { auth } from "@/auth"
import { isHealthClaimStaff } from "@/lib/health-claim"
import { HealthClaimMemoDetail } from "@/components/health-claim-memo-views"

export default async function PetugasNotaDinasDetailPage({ params }: { params: Promise<{ publicId: string }> }) {
  const session = await auth()
  const user = session?.user
  if (!user?.employeeId) redirect("/login")
  if (!(await isHealthClaimStaff(user.employeeId, "PETUGAS"))) notFound()

  const { publicId } = await params
  const view = await HealthClaimMemoDetail({
    publicId,
    viewer: user,
    breadcrumbItems: [
      { label: "Dashboard", href: "/pegawai/dashboard" },
      { label: "Pemeriksaan Klaim", href: "/pegawai/pemeriksaan-klaim" },
      { label: "Nota Dinas", href: "/pegawai/pemeriksaan-klaim/nota-dinas" },
    ],
    claimHref: (id) => `/pegawai/pemeriksaan-klaim/${id}`,
  })
  if (!view) notFound()
  return view
}
