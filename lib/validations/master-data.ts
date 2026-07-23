import { z } from "zod"

export const nameOnlySchema = z.object({
  name: z.string().min(1, "Nama wajib diisi"),
})

export const departmentSchema = z.object({
  name: z.string().min(1, "Nama bagian wajib diisi"),
  code: z.string().min(1, "Kode bagian wajib diisi"),
  headEmployeeId: z.coerce.number().int().positive().optional().or(z.literal("")),
})

export const workLocationSchema = z.object({
  name: z.string().min(1, "Nama lokasi kerja wajib diisi"),
  address: z.string().optional(),
  latitude: z.coerce.number().min(-90).max(90).optional().or(z.literal("")),
  longitude: z.coerce.number().min(-180).max(180).optional().or(z.literal("")),
  geofenceRadius: z.coerce.number().positive("Radius harus lebih dari 0").default(100),
})

export const workShiftSchema = z.object({
  name: z.string().min(1, "Nama shift wajib diisi"),
  type: z.enum(["PEGAWAI", "OUTSOURCING"]),
  checkInTime: z.string().min(1, "Jam masuk wajib diisi"),
  checkOutTime: z.string().min(1, "Jam pulang wajib diisi"),
  // Angka hari 0=Minggu..6=Sabtu (konvensi Date.getDay() JS), dikirim dari
  // checkbox jadi array — lihat catatan di prisma/schema.prisma WorkShift.workDays.
  workDays: z.array(z.string()).min(1, "Pilih minimal 1 hari kerja"),
})

export const workShiftAdjustmentSchema = z.object({
  workShiftId: z.coerce.number().int().positive("Jam kerja wajib dipilih"),
  name: z.string().min(1, "Nama penyesuaian wajib diisi"),
  startDate: z.string().min(1, "Tanggal mulai wajib diisi"),
  endDate: z.string().min(1, "Tanggal selesai wajib diisi"),
  checkInTime: z.string().min(1, "Jam masuk wajib diisi"),
  checkOutTime: z.string().min(1, "Jam pulang wajib diisi"),
})

export const attendanceDeviceSchema = z.object({
  name: z.string().min(1, "Nama lokasi/mesin wajib diisi"),
  ip: z.string().min(1, "IP mesin wajib diisi"),
  loginUser: z.string().min(1, "Username login mesin wajib diisi"),
  loginPass: z.string().min(1, "Password login mesin wajib diisi"),
  active: z
    .string()
    .optional()
    .transform((v) => v === "on"),
})

export const nationalHolidaySchema = z.object({
  date: z.string().min(1, "Tanggal wajib diisi"),
  name: z.string().min(1, "Nama hari libur wajib diisi"),
  // Checkbox HTML cuma muncul di FormData kalau dicentang.
  isOfficeOpen: z
    .string()
    .optional()
    .transform((v) => v === "on"),
})
