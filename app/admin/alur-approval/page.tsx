import { prisma } from "@/lib/prisma"
import { LEAVE_TYPES } from "@/lib/leave-types"
import { Breadcrumb } from "@/components/breadcrumb"
import { ApprovalFlowCard, type ApprovalStepValue } from "@/components/approval-flow-card"

export default async function AlurApprovalPage() {
  const [flows, employees] = await Promise.all([
    prisma.approvalFlow.findMany({
      include: {
        steps: { orderBy: { order: "asc" }, include: { approverEmployee: { select: { fullName: true } } } },
      },
    }),
    prisma.employee.findMany({
      where: { isActive: true, isDeleted: false },
      select: { id: true, fullName: true, position: { select: { name: true } } },
      orderBy: { fullName: "asc" },
    }),
  ])

  const employeeOptions = employees.map((e) => ({
    id: e.id,
    fullName: e.fullName,
    // Direksi = jabatan Direktur/Direktur Utama — belum ada penanda khusus di
    // skema, jadi dideteksi dari nama jabatan.
    isDireksi: e.position.name.toLowerCase().startsWith("direktur"),
  }))

  const flowByLeaveType = new Map(
    flows.map((flow) => [
      flow.leaveType,
      flow.steps.map(
        (step): ApprovalStepValue => ({
          approverType: step.approverType,
          unlockAfter: step.unlockAfter,
          approverEmployeeId: step.approverEmployeeId,
          approverEmployeeName: step.approverEmployee?.fullName ?? null,
        })
      ),
    ])
  )

  return (
    <div>
      <Breadcrumb
        items={[
          { label: "Dashboard", href: "/admin/dashboard" },
          { label: "Alur Approval" },
        ]}
      />
      <h1 className="mb-1 text-2xl font-semibold">Alur Approval</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Atur urutan approver per jenis izin. Saat ini hanya alur Izin Lembur
        yang benar-benar dijalankan sistem (seluruh step, berurutan) — jenis
        izin lain tersimpan sebagai konfigurasi untuk diaktifkan bertahap.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        {LEAVE_TYPES.map((type) => (
          <ApprovalFlowCard
            key={type.value}
            leaveTypeValue={type.value}
            initialSteps={flowByLeaveType.get(type.value) ?? []}
            employees={employeeOptions}
          />
        ))}
      </div>
    </div>
  )
}
