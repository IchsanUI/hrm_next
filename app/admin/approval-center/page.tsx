import { auth } from "@/auth"
import { getApprovalCenterData } from "@/lib/approval-queue"
import { Breadcrumb } from "@/components/breadcrumb"
import { ApprovalCenterContent } from "@/components/approval-center-content"

export default async function AdminApprovalCenterPage() {
  const session = await auth()
  const { queue, approvedThisMonth, rejectedThisMonth } = await getApprovalCenterData(
    session?.user.employeeId
  )

  return (
    <div>
      <Breadcrumb
        items={[
          { label: "Dashboard", href: "/admin/dashboard" },
          { label: "Approval Center" },
        ]}
      />
      <ApprovalCenterContent
        queue={queue}
        stats={{ pending: queue.length, approvedThisMonth, rejectedThisMonth }}
        basePath="/admin"
      />
    </div>
  )
}
