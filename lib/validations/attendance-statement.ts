import { z } from "zod"

function todayDateString() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export const MISSED_ATTENDANCE_TYPES = ["DATANG", "PULANG", "KEDUANYA"] as const
export type MissedAttendanceTypeValue = (typeof MISSED_ATTENDANCE_TYPES)[number]

export const MISSED_ATTENDANCE_TYPE_LABEL: Record<MissedAttendanceTypeValue, string> = {
  DATANG: "Tidak Absen Datang",
  PULANG: "Tidak Absen Pulang",
  KEDUANYA: "Tidak Absen Datang & Pulang",
}

// Isi 3 pernyataan wajib dicentang (lihat komentar di
// AttendanceStatementRequest pada schema.prisma) — divalidasi manual di
// server action, bukan lewat zod (checkbox HTML tidak muncul di FormData
// sama sekali kalau tidak dicentang, lebih sederhana dicek presence-nya
// langsung daripada dipaksakan ke skema literal zod).
export const ATTENDANCE_STATEMENT_ACKNOWLEDGEMENTS = [
  {
    field: "acknowledgeNotAbsent",
    label:
      "Saya menyatakan bahwa ketidakhadiran presensi pada tanggal tersebut murni karena lalai/lupa melakukan presensi, bukan karena tidak masuk kerja.",
  },
  {
    field: "acknowledgeConsequence",
    label:
      "Saya bersedia menerima konsekuensi sesuai peraturan perusahaan yang berlaku apabila pernyataan ini tidak benar.",
  },
  {
    field: "acknowledgeNoRepeat",
    label: "Saya berjanji tidak akan mengulangi kelalaian presensi ini di kemudian hari.",
  },
] as const

export const attendanceStatementRequestSchema = z
  .object({
    date: z.string().min(1, "Tanggal wajib diisi"),
    missedType: z.enum(MISSED_ATTENDANCE_TYPES, { message: "Jenis wajib dipilih" }),
    reason: z.string().min(1, "Alasan wajib diisi"),
  })
  .refine((data) => data.date <= todayDateString(), {
    message: "Tanggal tidak boleh di masa depan — ini pernyataan atas kejadian yang sudah lewat",
    path: ["date"],
  })

export const attendanceStatementRejectionSchema = z.object({
  rejectionReason: z.string().min(1, "Alasan penolakan wajib diisi"),
})
