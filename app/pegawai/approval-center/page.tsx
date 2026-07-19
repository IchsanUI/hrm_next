import { auth } from "@/auth"
import { getApprovalCenterData } from "@/lib/approval-queue"
import { ApprovalCenterContent } from "@/components/approval-center-content"

export default async function PegawaiApprovalCenterPage() {
  const session = await auth()
  const { queue, history, approvedThisMonth, rejectedThisMonth } = await getApprovalCenterData(
    session?.user.employeeId
  )

  return (
    <ApprovalCenterContent
      queue={queue}
      history={history}
      stats={{ pending: queue.length, approvedThisMonth, rejectedThisMonth }}
      basePath="/pegawai"
    />
  )
}
