"use server"

import { revalidatePath } from "next/cache"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { createNotification } from "@/lib/notifications"
import { getDepartmentColleagues } from "@/lib/department-colleagues"
import {
  getTeamFeedPage,
  getTeamFeedComments,
  findFeedRequestOwner,
  type TeamFeedCursor,
  type TeamFeedCommentRow,
  type TeamFeedKindFilter,
} from "@/lib/team-feed"
import { teamFeedCommentSchema, teamFeedPostSchema } from "@/lib/validations/team-feed"

export type TeamFeedCommentFormState = { error?: string } | undefined
export type TeamFeedPostFormState = { error?: string } | undefined

// Dipakai bersama oleh mention-notify di comment & post — validasi id yang
// dikirim client (dari autocomplete) tetap rekan aktif satu departemen,
// lalu kirim notifikasi ke tiap yang valid & punya akun User.
async function notifyMentions(
  commenter: { id: number; fullName: string; departmentId: number },
  mentionedEmployeeIds: number[],
  content: string,
  title: string
) {
  if (mentionedEmployeeIds.length === 0) return
  const colleagues = await getDepartmentColleagues(commenter.id, commenter.departmentId)
  const validIds = new Set(colleagues.map((c) => c.id))
  const toNotify = mentionedEmployeeIds.filter((id) => validIds.has(id))
  if (toNotify.length === 0) return

  const mentionedEmployees = await prisma.employee.findMany({
    where: { id: { in: toNotify } },
    select: { user: { select: { id: true } } },
  })
  const truncated = content.length > 120 ? `${content.slice(0, 120)}…` : content
  await Promise.all(
    mentionedEmployees
      .filter((e) => e.user)
      .map((e) =>
        createNotification({
          userId: e.user!.id,
          title,
          message: `${commenter.fullName} menyebut Anda: "${truncated}"`,
          link: "/pegawai/ruang-tim",
        })
      )
  )
}

function revalidateTeamFeedPaths() {
  revalidatePath("/admin/ruang-tim")
  revalidatePath("/pegawai/ruang-tim")
}

export async function createTeamFeedCommentAction(
  requestKind: string,
  requestId: number,
  mentionedEmployeeIds: number[],
  _prevState: TeamFeedCommentFormState,
  formData: FormData
): Promise<TeamFeedCommentFormState> {
  const session = await auth()
  if (!session?.user.employeeId) {
    return { error: "Akun Anda tidak terhubung ke data pegawai." }
  }
  const commenterId = session.user.employeeId

  const parsed = teamFeedCommentSchema.safeParse({
    content: formData.get("content"),
    requestKind,
    requestId,
    mentionedEmployeeIds,
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Komentar tidak valid." }
  }

  const commenter = await prisma.employee.findUnique({
    where: { id: commenterId },
    select: { id: true, fullName: true, departmentId: true },
  })
  if (!commenter) {
    return { error: "Akun Anda tidak terhubung ke data pegawai." }
  }

  // Otorisasi kritis — komentar cuma boleh dibuat kalau pengajuan yang
  // ditunjuk requestKind+requestId benar-benar ada, statusnya APPROVED (satu-
  // satunya status yang dirender di feed), dan pemiliknya satu departemen
  // dengan si pengomentar. Pesan error sengaja generik — jangan bocorkan
  // detail requestId departemen lain itu ada/tidaknya.
  const owner = await findFeedRequestOwner(parsed.data.requestKind, parsed.data.requestId)
  if (!owner || owner.status !== "APPROVED" || owner.departmentId !== commenter.departmentId) {
    return { error: "Pengajuan tidak ditemukan." }
  }

  await prisma.teamFeedComment.create({
    data: {
      requestKind: parsed.data.requestKind,
      requestId: parsed.data.requestId,
      employeeId: commenter.id,
      content: parsed.data.content,
    },
  })

  // @mention — id yang dikirim client HARUS berasal dari pilihan autocomplete
  // (bukan hasil parse teks bebas), dan tetap di-re-validasi di sini: harus
  // rekan aktif satu departemen dengan si pengomentar, jangan percaya begitu
  // saja id kiriman client.
  await notifyMentions(commenter, parsed.data.mentionedEmployeeIds, parsed.data.content, "Disebut di Ruang Tim")

  revalidateTeamFeedPaths()
  return { error: undefined }
}

// Post bebas ("status update") — bukan otomatis dari pengajuan izin,
// ditulis manual oleh pegawai. Dirender di feed yang sama dengan requestKind
// "post" (lihat lib/team-feed.ts), jadi bisa dikomentari & di-like lewat
// mekanisme polymorphic yang sama seperti entri izin.
export async function createTeamFeedPostAction(
  mentionedEmployeeIds: number[],
  _prevState: TeamFeedPostFormState,
  formData: FormData
): Promise<TeamFeedPostFormState> {
  const session = await auth()
  if (!session?.user.employeeId) {
    return { error: "Akun Anda tidak terhubung ke data pegawai." }
  }

  const parsed = teamFeedPostSchema.safeParse({
    content: formData.get("content"),
    mentionedEmployeeIds,
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Post tidak valid." }
  }

  const author = await prisma.employee.findUnique({
    where: { id: session.user.employeeId },
    select: { id: true, fullName: true, departmentId: true },
  })
  if (!author) {
    return { error: "Akun Anda tidak terhubung ke data pegawai." }
  }

  await prisma.teamFeedPost.create({
    data: { employeeId: author.id, content: parsed.data.content },
  })

  await notifyMentions(author, parsed.data.mentionedEmployeeIds, parsed.data.content, "Disebut di Ruang Tim")

  revalidateTeamFeedPaths()
  return { error: undefined }
}

export type ToggleLikeResult = { error?: string; liked?: boolean; likeCount?: number }

// Like/unlike satu entri feed (izin ATAU post). Toggle sederhana: kalau
// baris TeamFeedLike sudah ada, hapus (unlike); kalau belum, buat (like).
// Otorisasi sama seperti comment — entri harus APPROVED/valid dan satu
// departemen dengan si pemberi like.
export async function toggleEntryLikeAction(
  requestKind: string,
  requestId: number
): Promise<ToggleLikeResult> {
  const session = await auth()
  if (!session?.user.employeeId) {
    return { error: "Akun Anda tidak terhubung ke data pegawai." }
  }

  const me = await prisma.employee.findUnique({
    where: { id: session.user.employeeId },
    select: { id: true, departmentId: true },
  })
  if (!me) return { error: "Akun Anda tidak terhubung ke data pegawai." }

  const owner = await findFeedRequestOwner(requestKind, requestId)
  if (!owner || owner.status !== "APPROVED" || owner.departmentId !== me.departmentId) {
    return { error: "Pengajuan tidak ditemukan." }
  }

  const existing = await prisma.teamFeedLike.findUnique({
    where: { requestKind_requestId_employeeId: { requestKind, requestId, employeeId: me.id } },
  })

  if (existing) {
    await prisma.teamFeedLike.delete({ where: { id: existing.id } })
  } else {
    await prisma.teamFeedLike.create({ data: { requestKind, requestId, employeeId: me.id } })
  }

  const likeCount = await prisma.teamFeedLike.count({ where: { requestKind, requestId } })
  revalidateTeamFeedPaths()
  return { liked: !existing, likeCount }
}

// Like/unlike satu komentar — otorisasi lewat entri feed yang menaunginya
// (komentar cuma boleh dilihat/di-like oleh rekan satu departemen dengan
// pemilik entri, sama seperti aturan comment).
export async function toggleCommentLikeAction(commentId: number): Promise<ToggleLikeResult> {
  const session = await auth()
  if (!session?.user.employeeId) {
    return { error: "Akun Anda tidak terhubung ke data pegawai." }
  }

  const me = await prisma.employee.findUnique({
    where: { id: session.user.employeeId },
    select: { id: true, departmentId: true },
  })
  if (!me) return { error: "Akun Anda tidak terhubung ke data pegawai." }

  const comment = await prisma.teamFeedComment.findUnique({
    where: { id: commentId, isDeleted: false },
    select: { requestKind: true, requestId: true },
  })
  if (!comment) return { error: "Komentar tidak ditemukan." }

  const owner = await findFeedRequestOwner(comment.requestKind, comment.requestId)
  if (!owner || owner.departmentId !== me.departmentId) {
    return { error: "Komentar tidak ditemukan." }
  }

  const existing = await prisma.teamFeedCommentLike.findUnique({
    where: { commentId_employeeId: { commentId, employeeId: me.id } },
  })

  if (existing) {
    await prisma.teamFeedCommentLike.delete({ where: { id: existing.id } })
  } else {
    await prisma.teamFeedCommentLike.create({ data: { commentId, employeeId: me.id } })
  }

  const likeCount = await prisma.teamFeedCommentLike.count({ where: { commentId } })
  revalidateTeamFeedPaths()
  return { liked: !existing, likeCount }
}

export async function loadMoreTeamFeedAction(
  cursor: TeamFeedCursor,
  kindFilter: TeamFeedKindFilter = "all",
  sinceDate: Date | null = null
) {
  const session = await auth()
  if (!session?.user.employeeId) {
    return { rows: [], nextCursor: null }
  }
  return getTeamFeedPage(session.user.employeeId, cursor, 20, { kindFilter, sinceDate })
}

export async function getDepartmentColleaguesForMentionAction(): Promise<
  { id: number; fullName: string }[]
> {
  const session = await auth()
  if (!session?.user.employeeId) return []

  const me = await prisma.employee.findUnique({
    where: { id: session.user.employeeId },
    select: { departmentId: true },
  })
  if (!me) return []

  const colleagues = await getDepartmentColleagues(session.user.employeeId, me.departmentId)
  return colleagues.map((c) => ({ id: c.id, fullName: c.fullName }))
}

// Dipanggil client component (TeamFeedCard) saat pertama kali di-expand —
// tidak perlu otorisasi tambahan di sini selain login, karena kalau requestId
// yang diminta bukan di departemen si pemanggil, hasilnya cuma "kosong" (tidak
// ada baris TeamFeedComment yang bocor lintas departemen, wajar secara alami
// karena komentar cuma bisa dibuat lewat createTeamFeedCommentAction yang
// sudah mengunci requestKind+requestId ke departemen commenter-nya).
export async function getTeamFeedCommentsAction(
  requestKind: string,
  requestId: number
): Promise<TeamFeedCommentRow[]> {
  const session = await auth()
  if (!session?.user.employeeId) return []
  return getTeamFeedComments(requestKind, requestId, session.user.employeeId)
}
