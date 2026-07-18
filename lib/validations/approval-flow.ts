import { z } from "zod"

export const APPROVER_TYPES_REQUIRING_EMPLOYEE = ["DIREKSI", "PEGAWAI_TERTENTU"] as const

export const approvalStepSchema = z
  .object({
    approverType: z.enum([
      "ATASAN_LANGSUNG",
      "KEPALA_DEPARTEMEN",
      "DIREKSI",
      "HR",
      "PEGAWAI_PENGGANTI",
      "PEGAWAI_TERTENTU",
    ]),
    unlockAfter: z.boolean(),
    approverEmployeeId: z.number().int().positive().nullable().optional(),
  })
  .refine(
    (step) =>
      !APPROVER_TYPES_REQUIRING_EMPLOYEE.includes(
        step.approverType as (typeof APPROVER_TYPES_REQUIRING_EMPLOYEE)[number]
      ) || !!step.approverEmployeeId,
    { message: "Pilih pegawai untuk step Direksi / Pegawai Tertentu.", path: ["approverEmployeeId"] }
  )

export const approvalFlowSchema = z.object({
  leaveType: z.string().min(1),
  steps: z.array(approvalStepSchema).min(1, "Alur wajib punya minimal 1 step"),
})
