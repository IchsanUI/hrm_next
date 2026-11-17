import { redirect } from "next/navigation"
import { SlidersHorizontal } from "lucide-react"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { getHealthClaimSettings } from "@/lib/health-claim"
import { getMemoSettings } from "@/lib/health-claim-memo"
import { Breadcrumb } from "@/components/breadcrumb"
import { HealthClaimSettingsManager } from "@/components/health-claim-settings-manager"

export default async function HealthClaimSettingsPage() {
  const session = await auth()
  const user = session?.user
  const allowed =
    user?.role === "SUPER_ADMIN" ||
    (user?.role === "HR_ADMIN" && user.menuAccess.includes("payroll.klaim-kesehatan-pengaturan"))
  if (!allowed) redirect("/admin/dashboard")

  const [general, employees, staff, types, positions, statuses, memoSettings, memoFlow] = await Promise.all([
    getHealthClaimSettings(),
    prisma.employee.findMany({
      where: { isDeleted: false, isActive: true },
      select: { id: true, fullName: true, position: { select: { name: true } }, user: { select: { id: true } } },
      orderBy: { fullName: "asc" },
    }),
    prisma.healthClaimStaff.findMany({ select: { employeeId: true, role: true } }),
    prisma.healthClaimType.findMany({
      include: { _count: { select: { claims: true } } },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.position.findMany({
      select: {
        id: true,
        name: true,
        healthClaimPlafon: { select: { amount: true } },
        _count: { select: { employees: { where: { isDeleted: false, isActive: true } } } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.employmentStatus.findMany({
      select: {
        id: true,
        name: true,
        healthClaimEligibility: { select: { employmentStatusId: true } },
        _count: { select: { employees: { where: { isDeleted: false, isActive: true } } } },
      },
      orderBy: { name: "asc" },
    }),
    getMemoSettings(),
    prisma.healthClaimMemoFlowStep.findMany({ orderBy: { order: "asc" } }),
  ])

  return (
    <div>
      <Breadcrumb
        items={[
          { label: "Dashboard", href: "/admin/dashboard" },
          { label: "Payroll" },
          { label: "Klaim Kesehatan", href: "/admin/payroll/klaim-kesehatan" },
          { label: "Pengaturan" },
        ]}
      />
      <div className="mb-6 flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <SlidersHorizontal className="size-5" />
        </span>
        <div>
          <h1 className="text-xl font-semibold sm:text-2xl">Pengaturan Klaim Kesehatan</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Petugas, Accounting, jenis klaim, plafon per jabatan, dan siapa yang berhak mengajukan klaim.
          </p>
        </div>
      </div>

      <HealthClaimSettingsManager
        general={general}
        candidates={employees.map((e) => ({
          id: e.id,
          name: e.fullName,
          position: e.position.name,
          hasAccount: Boolean(e.user),
        }))}
        petugasIds={staff.filter((s) => s.role === "PETUGAS").map((s) => s.employeeId)}
        accountingIds={staff.filter((s) => s.role === "ACCOUNTING").map((s) => s.employeeId)}
        types={types.map((t) => ({
          publicId: t.publicId,
          name: t.name,
          description: t.description,
          requiredDocumentLabel: t.requiredDocumentLabel,
          isActive: t.isActive,
          sortOrder: t.sortOrder,
          claimCount: t._count.claims,
        }))}
        plafons={positions.map((p) => ({
          positionId: p.id,
          positionName: p.name,
          employeeCount: p._count.employees,
          amount: p.healthClaimPlafon?.amount ?? null,
        }))}
        statuses={statuses.map((s) => ({
          id: s.id,
          name: s.name,
          employeeCount: s._count.employees,
          eligible: Boolean(s.healthClaimEligibility),
        }))}
        memoFlow={memoFlow.map((f) => ({
          type: f.type,
          label: f.label,
          approverEmployeeId: f.approverEmployeeId,
          canAdjust: f.canAdjust,
        }))}
        memoFormat={{
          memoTo: memoSettings.memoTo,
          memoFrom: memoSettings.memoFrom,
          memoSubject: memoSettings.memoSubject,
          memoOpening: memoSettings.memoOpening,
          memoClosing: memoSettings.memoClosing,
          memoLetterNumberFormat: memoSettings.memoLetterNumberFormat ?? "",
        }}
      />
    </div>
  )
}
