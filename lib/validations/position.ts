import { z } from "zod"

export const positionSchema = z.object({
  name: z.string().min(1, "Nama jabatan wajib diisi"),
  attendanceRatePerDay: z.coerce.number().nonnegative().optional().or(z.literal("")),
})

export type PositionFormValues = z.infer<typeof positionSchema>
