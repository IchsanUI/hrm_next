import { z } from "zod"

export const employeeFormSchema = z.object({
  // .trim() WAJIB di sini — NIP ini dipakai langsung jadi username login
  // (lihat createEmployeeRecord), spasi tersisa di depan/belakang (mis. dari
  // copy-paste Excel) bikin login gagal terus walau username/password yang
  // diketik user sudah benar (exact-match lookup di auth.ts tidak toleran
  // whitespace) — insiden nyata pernah kejadian, jangan dihapus.
  employeeNumber: z.string().trim().min(1, "NIP wajib diisi"),
  // PIN mesin fingerprint — dipetakan manual, TIDAK otomatis dari employeeNumber
  // (lihat catatan di prisma/schema.prisma pada Employee.pinAttendance).
  pinAttendance: z.string().trim().optional().or(z.literal("")),
  fullName: z.string().trim().min(1, "Nama wajib diisi"),
  startDate: z.string().min(1, "Tanggal mulai kerja wajib diisi"),
  // Opsional — diisi admin kalau pegawai akan/sudah resign. Dipakai payroll
  // buat rekonsiliasi akhir tahun/resign (PP 58/2023 & Pasal 17), lihat
  // server/actions/payroll-period.ts.
  resignDate: z.string().optional().or(z.literal("")),
  departmentId: z.coerce.number().int().positive("Bagian wajib dipilih"),
  positionId: z.coerce.number().int().positive("Jabatan wajib dipilih"),
  workLocationId: z.coerce.number().int().positive("Lokasi kerja wajib dipilih"),
  employmentStatusId: z.coerce
    .number()
    .int()
    .positive("Status kepegawaian wajib dipilih"),
  reportsToId: z.coerce.number().int().positive().optional().or(z.literal("")),
  workShiftId: z.coerce.number().int().positive().optional().or(z.literal("")),
  birthDate: z.string().min(1, "Tanggal lahir wajib diisi"),
  birthPlace: z.string().min(1, "Tempat lahir wajib diisi"),
  gender: z.enum(["MALE", "FEMALE"]),
  nik: z.string().trim().min(1, "NIK wajib diisi"),
  address: z.string().min(1, "Alamat wajib diisi"),
  phone: z.string().trim().min(1, "No. HP wajib diisi"),
  email: z.string().trim().email("Email tidak valid"),
  lastEducation: z.string().optional(),
  major: z.string().optional(),
  degree: z.string().optional(),
  salaryGradeId: z.coerce.number().int().positive().optional().or(z.literal("")),
  salaryGradeStep: z.coerce.number().int().nonnegative().optional().or(z.literal("")),
  npwp: z.string().optional(),
  ptkpStatus: z
    .enum(["TK0", "TK1", "TK2", "TK3", "K0", "K1", "K2", "K3"])
    .optional()
    .or(z.literal("")),
  maritalStatus: z
    .enum(["SINGLE", "MARRIED", "DIVORCED", "WIDOWED"])
    .optional()
    .or(z.literal("")),
  exitLetterNumber: z.string().optional(),
  hobby: z.string().optional(),
  emergencyPhone: z.string().optional(),
  instagram: z.string().optional(),
  tiktok: z.string().optional(),
  facebook: z.string().optional(),
  ktpAddress: z.string().optional(),
  domicileKtp: z.string().optional(),
  motherName: z.string().optional(),
  fatherName: z.string().optional(),
  illness: z.string().optional(),
  sideBusiness: z.string().optional(),
  // Rekening bank — opsional, dipakai pembayaran klaim kesehatan via transfer.
  bankName: z.string().trim().max(100, "Nama bank maksimal 100 karakter").optional(),
  bankAccountNumber: z
    .string()
    .trim()
    .regex(/^[0-9 .-]*$/, "Nomor rekening hanya boleh berisi angka")
    .max(50, "Nomor rekening maksimal 50 karakter")
    .optional(),
  bankAccountHolder: z.string().trim().max(150, "Atas nama maksimal 150 karakter").optional(),
})

export type EmployeeFormValues = z.infer<typeof employeeFormSchema>

export const spouseFormSchema = z.object({
  fullName: z.string().min(1, "Nama wajib diisi"),
  occupation: z.string().optional(),
  birthPlace: z.string().optional(),
  birthDate: z.string().optional(),
})

export const childFormSchema = z.object({
  fullName: z.string().min(1, "Nama wajib diisi"),
  birthPlace: z.string().optional(),
  birthDate: z.string().optional(),
})

export const workHistoryFormSchema = z.object({
  date: z.string().min(1, "Tanggal wajib diisi"),
  description: z.string().min(1, "Uraian wajib diisi"),
})

export const trainingFormSchema = z.object({
  date: z.string().min(1, "Tanggal wajib diisi"),
  description: z.string().min(1, "Uraian wajib diisi"),
})

export const achievementFormSchema = z.object({
  date: z.string().min(1, "Tanggal wajib diisi"),
  description: z.string().min(1, "Uraian wajib diisi"),
})

export const rewardPunishmentFormSchema = z.object({
  date: z.string().min(1, "Tanggal wajib diisi"),
  type: z.enum(["REWARD", "PUNISHMENT"]),
  description: z.string().min(1, "Uraian wajib diisi"),
})

export const mutationFormSchema = z.object({
  date: z.string().min(1, "Tanggal wajib diisi"),
  oldPosition: z.string().optional(),
  newPosition: z.string().optional(),
  description: z.string().optional(),
})

export const assignmentLetterFormSchema = z.object({
  date: z.string().min(1, "Tanggal wajib diisi"),
  description: z.string().min(1, "Uraian wajib diisi"),
})
