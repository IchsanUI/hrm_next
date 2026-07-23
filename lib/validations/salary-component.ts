import { z } from "zod"

export const SALARY_COMPONENT_CATEGORIES = [
  "PENDAPATAN_TETAP",
  "PENDAPATAN_TIDAK_TETAP",
  "POTONGAN",
  "PINJAMAN",
] as const

export const SALARY_COMPONENT_CATEGORY_LABEL: Record<
  (typeof SALARY_COMPONENT_CATEGORIES)[number],
  string
> = {
  PENDAPATAN_TETAP: "Pendapatan Tetap",
  PENDAPATAN_TIDAK_TETAP: "Pendapatan Tidak Tetap",
  POTONGAN: "Potongan",
  PINJAMAN: "Pinjaman",
}

export const SALARY_COMPONENT_CALCULATION_TYPES = [
  "NOMINAL_TETAP",
  "PERSENTASE",
  "KEHADIRAN",
  "MANUAL_PERIODE",
] as const

export const SALARY_COMPONENT_CALCULATION_TYPE_LABEL: Record<
  (typeof SALARY_COMPONENT_CALCULATION_TYPES)[number],
  string
> = {
  NOMINAL_TETAP: "Nominal Tetap (per pegawai)",
  PERSENTASE: "Persentase dari Komponen Lain",
  KEHADIRAN: "Ditarik dari Data Kehadiran",
  MANUAL_PERIODE: "Manual per Periode",
}

export const salaryComponentSchema = z
  .object({
    name: z.string().min(1, "Nama komponen wajib diisi"),
    category: z.enum(SALARY_COMPONENT_CATEGORIES),
    calculationType: z.enum(SALARY_COMPONENT_CALCULATION_TYPES),
    percentageValue: z.coerce.number().positive().optional().or(z.literal("")),
    baseComponentId: z.coerce.number().int().positive().optional().or(z.literal("")),
    // Checkbox HTML cuma muncul di FormData kalau dicentang.
    includedInBruto: z.string().optional().transform((v) => v === "on"),
    isTaxable: z.string().optional().transform((v) => v === "on"),
    isBaseSalary: z.string().optional().transform((v) => v === "on"),
    displayOrder: z.coerce.number().int().default(0),
  })
  .refine(
    (data) =>
      data.calculationType !== "PERSENTASE" ||
      (data.percentageValue !== "" && data.percentageValue !== undefined),
    { message: "Persentase wajib diisi untuk jenis perhitungan ini", path: ["percentageValue"] }
  )
  .refine(
    (data) =>
      data.calculationType !== "PERSENTASE" ||
      (data.baseComponentId !== "" && data.baseComponentId !== undefined),
    { message: "Komponen dasar wajib dipilih untuk jenis perhitungan ini", path: ["baseComponentId"] }
  )

export type SalaryComponentFormValues = z.infer<typeof salaryComponentSchema>
