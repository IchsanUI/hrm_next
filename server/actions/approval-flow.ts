"use server"

import { revalidatePath } from "next/cache"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity-log"
import { approvalFlowSchema } from "@/lib/validations/approval-flow"

export type ApprovalFlowActionState = { error?: string; success?: boolean } | undefined

export async function saveApprovalFlowAction(
  _prevState: ApprovalFlowActionState,
  formData: FormData
): Promise<ApprovalFlowActionState> {
  const session = await auth()
  const isAdminRole = session?.user.role === "SUPER_ADMIN" || session?.user.role === "HR_ADMIN"
  if (!session?.user || !isAdminRole) {
    return { error: "Anda tidak berwenang mengubah alur approval." }
  }

  const leaveType = formData.get("leaveType")
  const stepsRaw = formData.get("steps")
  if (typeof leaveType !== "string" || typeof stepsRaw !== "string") {
    return { error: "Data tidak valid." }
  }

  let stepsParsed: unknown
  try {
    stepsParsed = JSON.parse(stepsRaw)
  } catch {
    return { error: "Data step tidak valid." }
  }

  const parsed = approvalFlowSchema.safeParse({ leaveType, steps: stepsParsed })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Data tidak valid." }
  }

  await prisma.$transaction(async (tx) => {
    const flow = await tx.approvalFlow.upsert({
      where: { leaveType: parsed.data.leaveType },
      update: {},
      create: { leaveType: parsed.data.leaveType },
    })

    await tx.approvalFlowStep.deleteMany({ where: { flowId: flow.id } })
    await tx.approvalFlowStep.createMany({
      data: parsed.data.steps.map((step, index) => ({
        flowId: flow.id,
        order: index + 1,
        approverType: step.approverType,
        unlockAfter: step.unlockAfter,
        approverEmployeeId: step.approverEmployeeId ?? null,
      })),
    })
  })

  await logActivity({
    userId: Number(session.user.id),
    username: session.user.username,
    action: "UPDATE",
    entityType: "ApprovalFlow",
    description: `${session.user.username} memperbarui alur approval untuk "${parsed.data.leaveType}".`,
  })

  revalidatePath("/admin/alur-approval")
  return { success: true }
}
