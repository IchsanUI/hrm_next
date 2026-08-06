import { z } from "zod"

export const teamFeedPostSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, "Tulis sesuatu dulu sebelum posting.")
    .max(1000, "Post maksimal 1000 karakter."),
  mentionedEmployeeIds: z.array(z.coerce.number().int().positive()).default([]),
})

export const teamFeedCommentSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, "Komentar tidak boleh kosong.")
    .max(1000, "Komentar maksimal 1000 karakter."),
  requestKind: z.string().min(1),
  requestId: z.coerce.number().int().positive(),
  // Hanya berisi id yang benar-benar dipilih dari dropdown autocomplete —
  // server tetap WAJIB re-validasi tiap id ini adalah rekan satu departemen
  // yang aktif sebelum mengirim notifikasi (lihat server/actions/team-feed.ts).
  mentionedEmployeeIds: z.array(z.coerce.number().int().positive()).default([]),
})
