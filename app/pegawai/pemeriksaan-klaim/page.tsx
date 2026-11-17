import { notFound, redirect } from "next/navigation"

import { auth } from "@/auth"
import { isHealthClaimStaff } from "@/lib/health-claim"
import { HealthClaimClaimsOverview } from "@/components/health-claim-claims-overview"

// Menu khusus petugas klaim yang ditunjuk di Pengaturan Klaim Kesehatan —
// tidak perlu peran HR Admin maupun akses dari Manajemen Akses HR.
export default async function PemeriksaanKlaimPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const session = await auth()
  const employeeId = session?.user.employeeId
  if (!employeeId) redirect("/login")
  if (!(await isHealthClaimStaff(employeeId, "PETUGAS"))) notFound()

  const { status } = await searchParams
  return (
    <HealthClaimClaimsOverview
      basePath="/pegawai/pemeriksaan-klaim"
      status={status ?? "MENUNGGU_KONFIRMASI"}
      breadcrumbItems={[{ label: "Dashboard", href: "/pegawai/dashboard" }, { label: "Pemeriksaan Klaim" }]}
      title="Pemeriksaan Klaim Kesehatan"
      description="Periksa dan konfirmasi klaim kesehatan pegawai, lalu kumpulkan untuk Nota Dinas."
      showSetup={false}
      memoListHref="/pegawai/pemeriksaan-klaim/nota-dinas"
      memoNewHref="/pegawai/pemeriksaan-klaim/nota-dinas/baru"
    />
  )
}
