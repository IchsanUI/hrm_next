import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { HealthClaimClaimsOverview } from "@/components/health-claim-claims-overview"

export default async function KlaimKesehatanAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const session = await auth()
  const user = session?.user
  const allowed =
    user?.role === "SUPER_ADMIN" || (user?.role === "HR_ADMIN" && user.menuAccess.includes("payroll.klaim-kesehatan"))
  if (!allowed) redirect("/admin/dashboard")
  const canSettings =
    user.role === "SUPER_ADMIN" || user.menuAccess.includes("payroll.klaim-kesehatan-pengaturan")
  const { status } = await searchParams

  return (
    <HealthClaimClaimsOverview
      basePath="/admin/payroll/klaim-kesehatan"
      status={status}
      breadcrumbItems={[{ label: "Dashboard", href: "/admin/dashboard" }, { label: "Payroll" }, { label: "Klaim Kesehatan" }]}
      title="Klaim Kesehatan"
      description="Klaim biaya kesehatan pegawai, dari pengajuan sampai pembayaran."
      settingsHref={canSettings ? "/admin/payroll/klaim-kesehatan/pengaturan" : undefined}
      showSetup
      memoListHref="/admin/payroll/klaim-kesehatan/nota-dinas"
      rekapHref="/admin/payroll/klaim-kesehatan/rekap"
    />
  )
}
