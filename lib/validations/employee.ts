import { z } from "zod"

export const employeeFormSchema = z.object({
  employeeNumber: z.string().min(1, "NIP wajib diisi"),
  // PIN mesin fingerprint — dipetakan manual, TIDAK otomatis dari employeeNumber
  // (lihat catatan di prisma/schema.prisma pada Employee.pinAttendance).
  pinAttendance: z.string().optional().or(z.literal("")),
  fullName: z.string().min(1, "Nama wajib diisi"),
  startDate: z.string().min(1, "Tanggal mulai kerja wajib diisi"),
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
  nik: z.string().min(1, "NIK wajib diisi"),
  address: z.string().min(1, "Alamat wajib diisi"),
  phone: z.string().min(1, "No. HP wajib diisi"),
  email: z.string().email("Email tidak valid"),
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
})

export type EmployeeFormValues = z.infer<typeof employeeFormSchema>

// Field yang boleh diupdate pegawai sendiri lewat Profil Saya (kalau admin
// sudah mengaktifkan Employee.allowSelfUpdate) — cuma kontak & alamat, TIDAK
// termasuk data inti kepegawaian/pribadi yang harus lewat admin.
export const employeeSelfUpdateSchema = z.object({
  phone: z.string().min(1, "No. HP wajib diisi"),
  email: z.string().email("Email tidak valid"),
  address: z.string().min(1, "Alamat wajib diisi"),
  emergencyPhone: z.string().optional(),
  instagram: z.string().optional(),
  tiktok: z.string().optional(),
  facebook: z.string().optional(),
  ktpAddress: z.string().optional(),
})

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
