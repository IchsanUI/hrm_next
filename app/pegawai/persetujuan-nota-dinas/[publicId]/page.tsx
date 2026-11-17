import { notFound, redirect } from "next/navigation"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { canViewMemo } from "@/lib/health-claim-memo"
import { HealthClaimMemoDetail } from "@/components/health-claim-memo-views"

// Halaman tinjauan Nota Dinas untuk penyetuju & Direktur — dibuka dari
// Approval Center atau notifikasi. Penyetuju tidak perlu akses menu admin.
export default async function PersetujuanNotaDinasPage({ params }: { params: Promise<{ publicId: string }> }) {
  const session = await auth()
  const user = session?.user
  if (!user?.employeeId) redirect("/login")

  const { publicId } = await params
  const memo = await prisma.healthClaimMemo.findUnique({ where: { publicId }, select: { id: true } })
  if (!memo || !(await canViewMemo(user, memo.id))) notFound()

  const view = await HealthClaimMemoDetail({
    publicId,
    viewer: user,
    showPayments: false,
    breadcrumbItems: [
      { label: "Dashboard", href: "/pegawai/dashboard" },
      { label: "Approval Center", href: "/pegawai/approval-center" },
    ],
  })
  if (!view) notFound()
  return view
}
