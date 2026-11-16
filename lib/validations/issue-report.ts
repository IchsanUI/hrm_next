import { z } from "zod"

import { ISSUE_CATEGORIES, ISSUE_STATUSES } from "@/lib/issue-report-labels"

export const issueReportSchema = z.object({
  category: z.enum(ISSUE_CATEGORIES, { message: "Pilih kategori kendala" }),
  title: z.string().trim().min(1, "Judul wajib diisi").max(150, "Judul maksimal 150 karakter"),
  description: z
    .string()
    .trim()
    .min(10, "Jelaskan kendala minimal 10 karakter")
    .max(2000, "Deskripsi maksimal 2000 karakter"),
})

export const issueReportUpdateSchema = z
  .object({
    status: z.enum(ISSUE_STATUSES),
    adminNote: z.string().trim().max(2000, "Catatan maksimal 2000 karakter").optional(),
  })
  .refine((v) => v.status !== "DITOLAK" || !!v.adminNote, {
    message: "Catatan wajib diisi kalau laporan ditolak",
    path: ["adminNote"],
  })
