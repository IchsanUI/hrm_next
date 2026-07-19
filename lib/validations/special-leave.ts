import { z } from "zod"

// Pasal 41: Cuti Haji maks. 40 hari, Cuti Umroh maks. 20 hari.
export const SPECIAL_LEAVE_MAX_DAYS: Record<"HAJI" | "UMROH", number> = {
  HAJI: 40,
  UMROH: 20,
}

export const SPECIAL_LEAVE_TYPE_LABEL: Record<"HAJI" | "UMROH", string> = {
  HAJI: "Cuti Khusus Haji",
  UMROH: "Cuti Khusus Umroh",
}

function todayDateString() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function specialLeaveDurationDays(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00.000Z`)
  const end = new Date(`${endDate}T00:00:00.000Z`)
  return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
}

export const specialLeaveRequestSchema = z
  .object({
    type: z.enum(["HAJI", "UMROH"]),
    startDate: z.string().min(1, "Tanggal mulai wajib diisi"),
    endDate: z.string().min(1, "Tanggal selesai wajib diisi"),
    reason: z.string().optional(),
    substituteEmployeeId: z.coerce.number().int().positive().optional().or(z.literal("")),
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: "Tanggal selesai tidak boleh sebelum tanggal mulai",
    path: ["endDate"],
  })
  .refine((data) => data.startDate >= todayDateString(), {
    message: "Tanggal mulai tidak boleh di hari yang sudah lewat",
    path: ["startDate"],
  })
  .refine(
    (data) => specialLeaveDurationDays(data.startDate, data.endDate) <= SPECIAL_LEAVE_MAX_DAYS[data.type],
    {
      message:
        "Durasi melebihi batas maksimal Pasal 41 (Haji 40 hari, Umroh 20 hari).",
      path: ["endDate"],
    }
  )

export const specialLeaveRejectionSchema = z.object({
  rejectionReason: z.string().min(1, "Alasan penolakan wajib diisi"),
})

export const specialLeaveRevisionSchema = z.object({
  rejectionReason: z.string().min(1, "Alasan tidak bersedia wajib diisi"),
})

export const specialLeaveResubmitSchema = z.object({
  newSubstituteEmployeeId: z.coerce.number().int().positive("Pilih pegawai pengganti baru"),
})
