import { prisma } from "@/lib/prisma"
import { DISPENSATION_CATEGORY_LABEL } from "@/lib/validations/dispensation"
import { MISSED_ATTENDANCE_TYPE_LABEL } from "@/lib/validations/attendance-statement"
import { getDepartmentColleagues } from "@/lib/department-colleagues"
import type { ApprovalQueueRow } from "@/components/approval-center-content"

// "Ruang Tim" — feed aktivitas izin/absensi APPROVED milik rekan satu
// departemen. Entrinya TIDAK disimpan sebagai baris tersendiri — dihitung
// on-the-fly dari 13 model *Request yang sudah ada, persis pola fan-out
// getApprovalCenterData/getPendingApprovalCount di lib/approval-queue.ts,
// bedanya di sini query LANGSUNG ke model request (bukan approval step) dan
// difilter status APPROVED + departemen yang sama.
//
// PENTING (privasi, sesuai keputusan produk): field select di bawah SENGAJA
// tidak pernah menyertakan dokumen/lampiran (evidenceUrl, medicalCertificateUrl,
// supportingDocumentUrl, OvertimeProof.url), koordinat GPS, atau kolom
// alasan/detail bebas-teks (reason/detail/task) — feed cuma menampilkan
// ringkasan: nama, jenis izin, tanggal, dan nama pengganti kalau ada.

// "post" — status update bebas yang ditulis pegawai sendiri (bukan
// otomatis dari pengajuan izin), lihat model TeamFeedPost.
export type TeamFeedRequestKind = ApprovalQueueRow["kind"] | "post"

export type TeamFeedRow = {
  requestKind: TeamFeedRequestKind
  requestId: number
  applicantEmployeeId: number
  applicant: string
  applicantPhotoUrl: string | null
  // Frasa kerja singkat buat baris header, mis. "mengajukan Izin Sakit" —
  // dirender sebagai "{applicant} {actionLabel}", meniru gaya DashboardRecentActivity.
  // Kosong untuk kind "post" (post dirender langsung dari `detail`, tanpa
  // frasa kerja).
  actionLabel: string
  // Info tambahan (tanggal/pengganti) dirender di kotak abu-abu di bawah
  // header, kosong kalau jenis izinnya tidak punya info tambahan yang perlu.
  // Untuk kind "post", inilah isi post-nya sendiri.
  detail: string
  occurredAt: Date
  commentCount: number
  likeCount: number
  likedByMe: boolean
}

export type TeamFeedCursor = { occurredAt: Date; requestKind: string; requestId: number } | null

export type TeamFeedCommentRow = {
  id: number
  authorName: string
  authorPhotoUrl: string | null
  content: string
  createdAt: Date
  likeCount: number
  likedByMe: boolean
}

function formatDate(date: Date) {
  return date.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })
}

function formatDateRange(start: Date, end: Date) {
  return start.getTime() === end.getTime()
    ? formatDate(start)
    : `${formatDate(start)} – ${formatDate(end)}`
}

function substituteClause(name: string | null) {
  return name ? `, digantikan oleh ${name}` : ""
}

// Foto yang dipakai di Ruang Tim SENGAJA foto akun self-service
// (User.avatarUrl, diatur pegawai sendiri lewat Pengaturan Akun) — BUKAN
// Employee.photoUrl (foto resmi kepegawaian yang cuma admin bisa ubah).
// Employee.user opsional (bisa null kalau akun belum dibuat/dihapus), dan
// avatarUrl-nya sendiri juga opsional — makanya optional chaining ganda.
const EMPLOYEE_SELECT = {
  id: true,
  fullName: true,
  user: { select: { avatarUrl: true } },
} as const

type FeedEmployee = { id: number; fullName: string; user: { avatarUrl: string | null } | null }

function baseRow(
  requestKind: TeamFeedRequestKind,
  requestId: number,
  employee: FeedEmployee,
  actionLabel: string,
  detail: string,
  occurredAt: Date | null,
  createdAt: Date,
  commentCount: number
): TeamFeedRow {
  return {
    requestKind,
    requestId,
    applicantEmployeeId: employee.id,
    applicant: employee.fullName,
    applicantPhotoUrl: employee.user?.avatarUrl ?? null,
    actionLabel,
    detail,
    occurredAt: occurredAt ?? createdAt,
    commentCount,
    likeCount: 0,
    likedByMe: false,
  }
}

// Nama-nama yang bisa muncul sebagai "@Nama" di feed departemen si employeeId
// (dirinya sendiri + rekan sedepartemen) — dipakai murni buat highlight visual
// @mention di komponen MentionText, bukan buat otorisasi apa pun.
export async function getMentionableNames(employeeId: number): Promise<string[]> {
  const me = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { fullName: true, departmentId: true },
  })
  if (!me) return []
  const colleagues = await getDepartmentColleagues(employeeId, me.departmentId)
  return [me.fullName, ...colleagues.map((c) => c.fullName)]
}

export type TeamFeedKindFilter = "all" | "izin" | "post"

// Re-export dari lib/team-feed-window.ts (file terpisah tanpa dependency
// Prisma) supaya pemanggil lama yang sudah import dari sini tetap jalan.
export { FEED_DEFAULT_WINDOW_DAYS, defaultFeedSinceDate } from "@/lib/team-feed-window"

export async function getTeamFeedPage(
  employeeId: number,
  cursor: TeamFeedCursor = null,
  pageSize = 20,
  options: { kindFilter?: TeamFeedKindFilter; sinceDate?: Date | null } = {}
): Promise<{ rows: TeamFeedRow[]; nextCursor: TeamFeedCursor }> {
  const { kindFilter = "all", sinceDate = null } = options
  const me = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { departmentId: true },
  })
  if (!me) return { rows: [], nextCursor: null }

  const departmentId = me.departmentId

  // Rentang tanggal — gabungan cursor (paginasi "muat lebih banyak") DAN
  // sinceDate (default tampilan cuma 30 hari terakhir, lihat
  // server/actions/team-feed.ts) supaya query tidak perlu menyisir seluruh
  // riwayat departemen tiap kali dibuka.
  const dateRange: { gte?: Date; lt?: Date } = {}
  if (sinceDate) dateRange.gte = sinceDate
  if (cursor) dateRange.lt = cursor.occurredAt
  const hasDateRange = dateRange.gte !== undefined || dateRange.lt !== undefined

  // Filter tab "Semua/Izin/Post" — skip query yang tidak relevan sama sekali
  // (bukan cuma di-filter di JS sesudahnya) supaya beban ke DB juga berkurang.
  const includeIzin = kindFilter !== "post"
  const includePosts = kindFilter !== "izin"

  const [
    posts,
    overtime,
    officeExit,
    offSiteAttendance,
    attendanceStatement,
    earlyLeave,
    lateArrival,
    sickLeave,
    cuti,
    maternityLeave,
    specialLeave,
    dispensation,
    cutiBesar,
    unpaidLeave,
  ] = await Promise.all([
    includePosts
      ? prisma.teamFeedPost.findMany({
          where: {
            isDeleted: false,
            employee: { departmentId, isActive: true, isDeleted: false },
            ...(hasDateRange ? { createdAt: dateRange } : {}),
          },
          select: { id: true, content: true, createdAt: true, employee: { select: EMPLOYEE_SELECT } },
          orderBy: { createdAt: "desc" },
          take: pageSize,
        })
      : Promise.resolve([]),
    includeIzin
      ? prisma.overtimeRequest.findMany({
          where: {
            status: "APPROVED",
            employee: { departmentId, isActive: true, isDeleted: false },
            ...(hasDateRange ? { approvedAt: dateRange } : {}),
          },
          select: { id: true, date: true, approvedAt: true, createdAt: true, employee: { select: EMPLOYEE_SELECT } },
          orderBy: { approvedAt: "desc" },
          take: pageSize,
        })
      : Promise.resolve([]),
    includeIzin
      ? prisma.officeExitRequest.findMany({
          where: {
            status: "APPROVED",
            employee: { departmentId, isActive: true, isDeleted: false },
            ...(hasDateRange ? { approvedAt: dateRange } : {}),
          },
          select: { id: true, category: true, approvedAt: true, createdAt: true, employee: { select: EMPLOYEE_SELECT } },
          orderBy: { approvedAt: "desc" },
          take: pageSize,
        })
      : Promise.resolve([]),
    includeIzin
      ? prisma.offSiteAttendanceRequest.findMany({
          where: {
            status: "APPROVED",
            employee: { departmentId, isActive: true, isDeleted: false },
            ...(hasDateRange ? { approvedAt: dateRange } : {}),
          },
          select: { id: true, date: true, approvedAt: true, createdAt: true, employee: { select: EMPLOYEE_SELECT } },
          orderBy: { approvedAt: "desc" },
          take: pageSize,
        })
      : Promise.resolve([]),
    includeIzin
      ? prisma.attendanceStatementRequest.findMany({
          where: {
            status: "APPROVED",
            employee: { departmentId, isActive: true, isDeleted: false },
            ...(hasDateRange ? { approvedAt: dateRange } : {}),
          },
          select: { id: true, date: true, missedType: true, approvedAt: true, createdAt: true, employee: { select: EMPLOYEE_SELECT } },
          orderBy: { approvedAt: "desc" },
          take: pageSize,
        })
      : Promise.resolve([]),
    includeIzin
      ? prisma.earlyLeaveRequest.findMany({
          where: {
            status: "APPROVED",
            employee: { departmentId, isActive: true, isDeleted: false },
            ...(hasDateRange ? { approvedAt: dateRange } : {}),
          },
          select: { id: true, approvedAt: true, createdAt: true, employee: { select: EMPLOYEE_SELECT } },
          orderBy: { approvedAt: "desc" },
          take: pageSize,
        })
      : Promise.resolve([]),
    includeIzin
      ? prisma.lateArrivalRequest.findMany({
          where: {
            status: "APPROVED",
            employee: { departmentId, isActive: true, isDeleted: false },
            ...(hasDateRange ? { approvedAt: dateRange } : {}),
          },
          select: { id: true, approvedAt: true, createdAt: true, employee: { select: EMPLOYEE_SELECT } },
          orderBy: { approvedAt: "desc" },
          take: pageSize,
        })
      : Promise.resolve([]),
    includeIzin
      ? prisma.sickLeaveRequest.findMany({
          where: {
            status: "APPROVED",
            employee: { departmentId, isActive: true, isDeleted: false },
            ...(hasDateRange ? { approvedAt: dateRange } : {}),
          },
          select: {
            id: true,
            startDate: true,
            endDate: true,
            substituteEmployeeName: true,
            approvedAt: true,
            createdAt: true,
            employee: { select: EMPLOYEE_SELECT },
          },
          orderBy: { approvedAt: "desc" },
          take: pageSize,
        })
      : Promise.resolve([]),
    includeIzin
      ? prisma.cutiRequest.findMany({
          where: {
            status: "APPROVED",
            employee: { departmentId, isActive: true, isDeleted: false },
            ...(hasDateRange ? { approvedAt: dateRange } : {}),
          },
          select: {
            id: true,
            startDate: true,
            endDate: true,
            substituteEmployeeName: true,
            approvedAt: true,
            createdAt: true,
            employee: { select: EMPLOYEE_SELECT },
          },
          orderBy: { approvedAt: "desc" },
          take: pageSize,
        })
      : Promise.resolve([]),
    includeIzin
      ? prisma.maternityLeaveRequest.findMany({
          where: {
            status: "APPROVED",
            employee: { departmentId, isActive: true, isDeleted: false },
            ...(hasDateRange ? { approvedAt: dateRange } : {}),
          },
          select: {
            id: true,
            type: true,
            startDate: true,
            endDate: true,
            substituteEmployeeName: true,
            approvedAt: true,
            createdAt: true,
            employee: { select: EMPLOYEE_SELECT },
          },
          orderBy: { approvedAt: "desc" },
          take: pageSize,
        })
      : Promise.resolve([]),
    includeIzin
      ? prisma.specialLeaveRequest.findMany({
          where: {
            status: "APPROVED",
            employee: { departmentId, isActive: true, isDeleted: false },
            ...(hasDateRange ? { approvedAt: dateRange } : {}),
          },
          select: {
            id: true,
            type: true,
            startDate: true,
            endDate: true,
            substituteEmployeeName: true,
            approvedAt: true,
            createdAt: true,
            employee: { select: EMPLOYEE_SELECT },
          },
          orderBy: { approvedAt: "desc" },
          take: pageSize,
        })
      : Promise.resolve([]),
    includeIzin
      ? prisma.dispensationRequest.findMany({
          where: {
            status: "APPROVED",
            employee: { departmentId, isActive: true, isDeleted: false },
            ...(hasDateRange ? { approvedAt: dateRange } : {}),
          },
          select: {
            id: true,
            category: true,
            startDate: true,
            endDate: true,
            substituteEmployeeName: true,
            approvedAt: true,
            createdAt: true,
            employee: { select: EMPLOYEE_SELECT },
          },
          orderBy: { approvedAt: "desc" },
          take: pageSize,
        })
      : Promise.resolve([]),
    includeIzin
      ? prisma.cutiBesarRequest.findMany({
          where: {
            status: "APPROVED",
            employee: { departmentId, isActive: true, isDeleted: false },
            ...(hasDateRange ? { approvedAt: dateRange } : {}),
          },
          select: {
            id: true,
            startDate: true,
            endDate: true,
            substituteEmployeeName: true,
            approvedAt: true,
            createdAt: true,
            employee: { select: EMPLOYEE_SELECT },
          },
          orderBy: { approvedAt: "desc" },
          take: pageSize,
        })
      : Promise.resolve([]),
    includeIzin
      ? prisma.unpaidLeaveRequest.findMany({
          where: {
            status: "APPROVED",
            employee: { departmentId, isActive: true, isDeleted: false },
            ...(hasDateRange ? { approvedAt: dateRange } : {}),
          },
          select: {
            id: true,
            startDate: true,
            endDate: true,
            substituteEmployeeName: true,
            approvedAt: true,
            createdAt: true,
            employee: { select: EMPLOYEE_SELECT },
          },
          orderBy: { approvedAt: "desc" },
          take: pageSize,
        })
      : Promise.resolve([]),
  ])

  const rows: TeamFeedRow[] = [
    ...posts.map((r) => baseRow("post", r.id, r.employee, "", r.content, r.createdAt, r.createdAt, 0)),
    ...overtime.map((r) =>
      baseRow(
        "lembur",
        r.id,
        r.employee,
        "mengajukan Izin Lembur",
        formatDate(r.date),
        r.approvedAt,
        r.createdAt,
        0
      )
    ),
    ...officeExit.map((r) =>
      baseRow(
        "meninggalkan_kantor",
        r.id,
        r.employee,
        "mengajukan Izin Meninggalkan Kantor",
        "",
        r.approvedAt,
        r.createdAt,
        0
      )
    ),
    ...offSiteAttendance.map((r) =>
      baseRow(
        "absen_luar_kantor",
        r.id,
        r.employee,
        "mengajukan Izin Absen Diluar Kantor",
        formatDate(r.date),
        r.approvedAt,
        r.createdAt,
        0
      )
    ),
    ...attendanceStatement.map((r) =>
      baseRow(
        "tidak_absen",
        r.id,
        r.employee,
        `mengajukan Izin Tidak Absen ${MISSED_ATTENDANCE_TYPE_LABEL[r.missedType]}`,
        formatDate(r.date),
        r.approvedAt,
        r.createdAt,
        0
      )
    ),
    ...earlyLeave.map((r) =>
      baseRow(
        "pulang_cepat",
        r.id,
        r.employee,
        "mengajukan Izin Pulang Cepat",
        "",
        r.approvedAt,
        r.createdAt,
        0
      )
    ),
    ...lateArrival.map((r) =>
      baseRow(
        "terlambat",
        r.id,
        r.employee,
        "mengajukan Izin Terlambat",
        "",
        r.approvedAt,
        r.createdAt,
        0
      )
    ),
    ...sickLeave.map((r) =>
      baseRow(
        "sakit",
        r.id,
        r.employee,
        "mengajukan Izin Sakit",
        `${formatDateRange(r.startDate, r.endDate)}${substituteClause(r.substituteEmployeeName)}`,
        r.approvedAt,
        r.createdAt,
        0
      )
    ),
    ...cuti.map((r) =>
      baseRow(
        "cuti",
        r.id,
        r.employee,
        "mengajukan Izin Cuti",
        `${formatDateRange(r.startDate, r.endDate)}${substituteClause(r.substituteEmployeeName)}`,
        r.approvedAt,
        r.createdAt,
        0
      )
    ),
    ...maternityLeave.map((r) =>
      baseRow(
        "cuti_bersalin",
        r.id,
        r.employee,
        `mengajukan ${r.type === "BERSALIN" ? "Cuti Bersalin" : "Cuti Gugur Kandungan"}`,
        `${formatDateRange(r.startDate, r.endDate)}${substituteClause(r.substituteEmployeeName)}`,
        r.approvedAt,
        r.createdAt,
        0
      )
    ),
    ...specialLeave.map((r) =>
      baseRow(
        "cuti_khusus",
        r.id,
        r.employee,
        `mengajukan ${r.type === "HAJI" ? "Cuti Khusus Haji" : "Cuti Khusus Umroh"}`,
        `${formatDateRange(r.startDate, r.endDate)}${substituteClause(r.substituteEmployeeName)}`,
        r.approvedAt,
        r.createdAt,
        0
      )
    ),
    ...dispensation.map((r) =>
      baseRow(
        "dispensasi",
        r.id,
        r.employee,
        `mengajukan Dispensasi (${DISPENSATION_CATEGORY_LABEL[r.category]})`,
        `${formatDateRange(r.startDate, r.endDate)}${substituteClause(r.substituteEmployeeName)}`,
        r.approvedAt,
        r.createdAt,
        0
      )
    ),
    ...cutiBesar.map((r) =>
      baseRow(
        "cuti_besar",
        r.id,
        r.employee,
        "mengajukan Cuti Besar",
        `${formatDateRange(r.startDate, r.endDate)}${substituteClause(r.substituteEmployeeName)}`,
        r.approvedAt,
        r.createdAt,
        0
      )
    ),
    ...unpaidLeave.map((r) =>
      baseRow(
        "cuti_diluar_tanggungan",
        r.id,
        r.employee,
        "mengajukan Cuti Di Luar Tanggungan",
        `${formatDateRange(r.startDate, r.endDate)}${substituteClause(r.substituteEmployeeName)}`,
        r.approvedAt,
        r.createdAt,
        0
      )
    ),
  ]
    .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())
    .slice(0, pageSize)

  if (rows.length === 0) {
    return { rows, nextCursor: null }
  }

  const keys = rows.map((r) => ({ requestKind: r.requestKind, requestId: r.requestId }))
  const [commentCounts, likeCounts, myLikes] = await Promise.all([
    getCommentCounts(keys),
    getLikeCounts(keys),
    getMyLikeKeys(employeeId, keys),
  ])
  for (const row of rows) {
    const key = `${row.requestKind}:${row.requestId}`
    row.commentCount = commentCounts.get(key) ?? 0
    row.likeCount = likeCounts.get(key) ?? 0
    row.likedByMe = myLikes.has(key)
  }

  const last = rows[rows.length - 1]
  const nextCursor: TeamFeedCursor =
    rows.length === pageSize
      ? { occurredAt: last.occurredAt, requestKind: last.requestKind, requestId: last.requestId }
      : null

  return { rows, nextCursor }
}

async function getCommentCounts(
  keys: { requestKind: string; requestId: number }[]
): Promise<Map<string, number>> {
  if (keys.length === 0) return new Map()
  const grouped = await prisma.teamFeedComment.groupBy({
    by: ["requestKind", "requestId"],
    where: {
      isDeleted: false,
      OR: keys.map((k) => ({ requestKind: k.requestKind, requestId: k.requestId })),
    },
    _count: { _all: true },
  })
  return new Map(grouped.map((g) => [`${g.requestKind}:${g.requestId}`, g._count._all]))
}

async function getLikeCounts(
  keys: { requestKind: string; requestId: number }[]
): Promise<Map<string, number>> {
  if (keys.length === 0) return new Map()
  const grouped = await prisma.teamFeedLike.groupBy({
    by: ["requestKind", "requestId"],
    where: { OR: keys.map((k) => ({ requestKind: k.requestKind, requestId: k.requestId })) },
    _count: { _all: true },
  })
  return new Map(grouped.map((g) => [`${g.requestKind}:${g.requestId}`, g._count._all]))
}

async function getMyLikeKeys(
  employeeId: number,
  keys: { requestKind: string; requestId: number }[]
): Promise<Set<string>> {
  if (keys.length === 0) return new Set()
  const mine = await prisma.teamFeedLike.findMany({
    where: {
      employeeId,
      OR: keys.map((k) => ({ requestKind: k.requestKind, requestId: k.requestId })),
    },
    select: { requestKind: true, requestId: true },
  })
  return new Set(mine.map((m) => `${m.requestKind}:${m.requestId}`))
}

export async function getTeamFeedComments(
  requestKind: string,
  requestId: number,
  viewerEmployeeId?: number
): Promise<TeamFeedCommentRow[]> {
  const comments = await prisma.teamFeedComment.findMany({
    where: { requestKind, requestId, isDeleted: false },
    select: {
      id: true,
      content: true,
      createdAt: true,
      employee: { select: { fullName: true, user: { select: { avatarUrl: true } } } },
      _count: { select: { likes: true } },
      likes: viewerEmployeeId ? { where: { employeeId: viewerEmployeeId }, select: { id: true } } : false,
    },
    orderBy: { createdAt: "asc" },
  })
  return comments.map((c) => ({
    id: c.id,
    authorName: c.employee.fullName,
    authorPhotoUrl: c.employee.user?.avatarUrl ?? null,
    content: c.content,
    createdAt: c.createdAt,
    likeCount: c._count.likes,
    likedByMe: viewerEmployeeId ? c.likes.length > 0 : false,
  }))
}

// Lookup pemilik satu entri request (dipakai server action buat otorisasi
// sebelum insert komentar) — mengembalikan null kalau requestKind tidak
// dikenal atau requestId tidak ditemukan.
export async function findFeedRequestOwner(
  requestKind: string,
  requestId: number
): Promise<{ employeeId: number; departmentId: number; status: string } | null> {
  switch (requestKind as TeamFeedRequestKind) {
    case "post": {
      const r = await prisma.teamFeedPost.findUnique({
        where: { id: requestId, isDeleted: false },
        select: { employee: { select: { id: true, departmentId: true } } },
      })
      // Post tidak punya field status — perlakukan sebagai "APPROVED" supaya
      // pengecekan otorisasi comment/like yang sama bisa dipakai ulang tanpa
      // perlu cabang khusus per kind di server action.
      return r ? { employeeId: r.employee.id, departmentId: r.employee.departmentId, status: "APPROVED" } : null
    }
    case "lembur": {
      const r = await prisma.overtimeRequest.findUnique({
        where: { id: requestId },
        select: { status: true, employee: { select: { id: true, departmentId: true } } },
      })
      return r ? { employeeId: r.employee.id, departmentId: r.employee.departmentId, status: r.status } : null
    }
    case "meninggalkan_kantor": {
      const r = await prisma.officeExitRequest.findUnique({
        where: { id: requestId },
        select: { status: true, employee: { select: { id: true, departmentId: true } } },
      })
      return r ? { employeeId: r.employee.id, departmentId: r.employee.departmentId, status: r.status } : null
    }
    case "absen_luar_kantor": {
      const r = await prisma.offSiteAttendanceRequest.findUnique({
        where: { id: requestId },
        select: { status: true, employee: { select: { id: true, departmentId: true } } },
      })
      return r ? { employeeId: r.employee.id, departmentId: r.employee.departmentId, status: r.status } : null
    }
    case "tidak_absen": {
      const r = await prisma.attendanceStatementRequest.findUnique({
        where: { id: requestId },
        select: { status: true, employee: { select: { id: true, departmentId: true } } },
      })
      return r ? { employeeId: r.employee.id, departmentId: r.employee.departmentId, status: r.status } : null
    }
    case "pulang_cepat": {
      const r = await prisma.earlyLeaveRequest.findUnique({
        where: { id: requestId },
        select: { status: true, employee: { select: { id: true, departmentId: true } } },
      })
      return r ? { employeeId: r.employee.id, departmentId: r.employee.departmentId, status: r.status } : null
    }
    case "terlambat": {
      const r = await prisma.lateArrivalRequest.findUnique({
        where: { id: requestId },
        select: { status: true, employee: { select: { id: true, departmentId: true } } },
      })
      return r ? { employeeId: r.employee.id, departmentId: r.employee.departmentId, status: r.status } : null
    }
    case "sakit": {
      const r = await prisma.sickLeaveRequest.findUnique({
        where: { id: requestId },
        select: { status: true, employee: { select: { id: true, departmentId: true } } },
      })
      return r ? { employeeId: r.employee.id, departmentId: r.employee.departmentId, status: r.status } : null
    }
    case "cuti": {
      const r = await prisma.cutiRequest.findUnique({
        where: { id: requestId },
        select: { status: true, employee: { select: { id: true, departmentId: true } } },
      })
      return r ? { employeeId: r.employee.id, departmentId: r.employee.departmentId, status: r.status } : null
    }
    case "cuti_bersalin": {
      const r = await prisma.maternityLeaveRequest.findUnique({
        where: { id: requestId },
        select: { status: true, employee: { select: { id: true, departmentId: true } } },
      })
      return r ? { employeeId: r.employee.id, departmentId: r.employee.departmentId, status: r.status } : null
    }
    case "cuti_khusus": {
      const r = await prisma.specialLeaveRequest.findUnique({
        where: { id: requestId },
        select: { status: true, employee: { select: { id: true, departmentId: true } } },
      })
      return r ? { employeeId: r.employee.id, departmentId: r.employee.departmentId, status: r.status } : null
    }
    case "dispensasi": {
      const r = await prisma.dispensationRequest.findUnique({
        where: { id: requestId },
        select: { status: true, employee: { select: { id: true, departmentId: true } } },
      })
      return r ? { employeeId: r.employee.id, departmentId: r.employee.departmentId, status: r.status } : null
    }
    case "cuti_besar": {
      const r = await prisma.cutiBesarRequest.findUnique({
        where: { id: requestId },
        select: { status: true, employee: { select: { id: true, departmentId: true } } },
      })
      return r ? { employeeId: r.employee.id, departmentId: r.employee.departmentId, status: r.status } : null
    }
    case "cuti_diluar_tanggungan": {
      const r = await prisma.unpaidLeaveRequest.findUnique({
        where: { id: requestId },
        select: { status: true, employee: { select: { id: true, departmentId: true } } },
      })
      return r ? { employeeId: r.employee.id, departmentId: r.employee.departmentId, status: r.status } : null
    }
    default:
      return null
  }
}
