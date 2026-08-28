import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity-log"
import { createNotification } from "@/lib/notifications"

// Aturan: pengajuan Izin Lembur otomatis DITOLAK kalau step approval
// Atasan Langsung/Kepala Departemen belum diproses dalam 24 jam sejak
// diajukan. Sengaja CUMA step itu yang punya deadline ini — begitu atasan
// langsung approve, itu sudah jadi fakta operasional (stafnya memang
// lembur dengan sepengetahuan atasan) yang tidak boleh dibatalkan lagi
// gara-gara approver berikutnya (mis. Direksi) lambat memproses.
//
// PENTING — step "Atasan Langsung/Kepala Departemen" BELUM TENTU order=1.
// server/actions/overtime.ts nge-skip OTOMATIS step-step di depannya yang
// approver-nya tidak bisa ditentukan (mis. PEGAWAI_PENGGANTI, belum
// diaktifkan di runtime) SAAT PENGAJUAN DIBUAT — jadi step yang beneran
// aktif (IN_PROGRESS) bisa jatuh di order 2, 3, dst tergantung berapa step
// di depannya yang ke-skip. Dulu kode ini hardcode `order: 1`, akibatnya
// pengajuan yang order-1-nya ke-skip TIDAK PERNAH auto-reject sama sekali
// walau menggantung berhari-hari — makanya sekarang dicari step approval
// EFEKTIF pertama (step pertama yang statusnya BUKAN SKIPPED), bukan
// literal order=1.
const AUTO_REJECT_AFTER_MS = 24 * 60 * 60 * 1000
const FIRST_APPROVER_TYPES = ["ATASAN_LANGSUNG", "KEPALA_DEPARTEMEN"] as const
const AUTO_REJECT_REASON =
  "Otomatis ditolak sistem — tidak diproses Atasan Langsung/Kepala Departemen dalam 24 jam sejak diajukan."

export type OvertimeAutoRejectResult = {
  checkedAt: string
  // false kalau SUPER_ADMIN sedang mematikan fitur ini lewat Pengaturan
  // Izin (IzinSettings.overtimeAutoRejectEnabled) — cron tetap dipanggil
  // seperti biasa, cuma jadi no-op, BUKAN error, supaya penjadwal eksternal
  // (crontab, dst) tidak perlu tahu status togglenya.
  enabled: boolean
  rejectedCount: number
  rejectedPublicIds: string[]
  failedIds: number[]
}

// Dipanggil dari route cron (app/api/cron/reject-expired-overtime/route.ts)
// — TIDAK dipanggil dari UI/server action mana pun, jadi tidak butuh
// `session` sama sekali. Aman dijalankan berkali-kali (idempotent): kalau
// dipanggil lagi sebelum ada pengajuan baru yang expired, `rejectedCount`
// bakal 0.
export async function runOvertimeAutoReject(): Promise<OvertimeAutoRejectResult> {
  const now = new Date()

  const izinSettings = await prisma.izinSettings.findUnique({ where: { id: 1 } })
  // Baris belum pernah dibuat (belum pernah upsert dari halaman Pengaturan
  // Izin sama sekali) = anggap default true, sama seperti kolomnya di schema.
  if (izinSettings && !izinSettings.overtimeAutoRejectEnabled) {
    return { checkedAt: now.toISOString(), enabled: false, rejectedCount: 0, rejectedPublicIds: [], failedIds: [] }
  }

  const cutoff = new Date(now.getTime() - AUTO_REJECT_AFTER_MS)

  // Tidak bisa difilter "step non-SKIPPED pertama" langsung lewat Prisma
  // WHERE (butuh urutan per-request) — ambil semua kandidat kedaluwarsa
  // dengan SELURUH approvalSteps-nya, saring step efektif pertama di JS.
  const candidateRequests = await prisma.overtimeRequest.findMany({
    where: { status: "PENDING_APPROVAL", createdAt: { lte: cutoff } },
    include: {
      employee: { select: { fullName: true, user: { select: { id: true } } } },
      approvalSteps: { orderBy: { order: "asc" } },
    },
  })

  const rejectedPublicIds: string[] = []
  const failedIds: number[] = []

  for (const request of candidateRequests) {
    const firstStep = request.approvalSteps.find((s) => s.status !== "SKIPPED")
    if (!firstStep) continue // semua step ke-skip (seharusnya tidak mungkin, request-nya sendiri dijaga butuh minimal 1 approver aktif saat dibuat)
    if (firstStep.status !== "IN_PROGRESS") continue // sudah diproses (APPROVED/REJECTED) — bukan urusan job ini
    if (!FIRST_APPROVER_TYPES.includes(firstStep.approverType as (typeof FIRST_APPROVER_TYPES)[number])) continue // step efektif pertamanya BUKAN Atasan Langsung/Kepala Departemen (mis. langsung DIREKSI) — tidak ada deadline 24 jam

    try {
      // updateMany dengan guard status di WHERE (bukan `update` biasa) —
      // supaya kalau approver kebetulan approve/tolak PERSIS di detik yang
      // sama job ini jalan, salah satu operasi otomatis no-op (count 0),
      // bukan saling menimpa.
      const { count: stepUpdated } = await prisma.overtimeApprovalStep.updateMany({
        where: { id: firstStep.id, status: "IN_PROGRESS" },
        data: { status: "REJECTED", notes: AUTO_REJECT_REASON, actedAt: now },
      })
      if (stepUpdated === 0) continue

      await prisma.overtimeApprovalStep.updateMany({
        where: { requestId: request.id, status: "WAITING" },
        data: { status: "SKIPPED", notes: "Dibatalkan — pengajuan ditolak otomatis di step sebelumnya." },
      })

      const { count: requestUpdated } = await prisma.overtimeRequest.updateMany({
        where: { id: request.id, status: "PENDING_APPROVAL" },
        data: { status: "REJECTED", rejectionReason: AUTO_REJECT_REASON },
      })
      if (requestUpdated === 0) continue

      if (request.employee.user?.id) {
        await createNotification({
          userId: request.employee.user.id,
          title: "Izin Lembur Ditolak Otomatis",
          message: `Pengajuan izin lembur Anda untuk tanggal ${request.date.toLocaleDateString("id-ID")} otomatis ditolak karena tidak diproses Atasan Langsung/Kepala Departemen dalam 24 jam.`,
          link: `/pegawai/riwayat-izin/${request.publicId}`,
        })
      }

      await logActivity({
        userId: null,
        username: "system",
        action: "UPDATE",
        entityType: "OvertimeRequest",
        description: `Sistem menolak otomatis izin lembur (${request.id}) milik "${request.employee.fullName}" — kedaluwarsa 24 jam tanpa diproses Atasan Langsung/Kepala Departemen.`,
      })

      rejectedPublicIds.push(request.publicId)
    } catch (err) {
      console.error(`Auto-reject overtime request ${request.id} gagal:`, err)
      failedIds.push(request.id)
    }
  }

  return {
    checkedAt: now.toISOString(),
    enabled: true,
    rejectedCount: rejectedPublicIds.length,
    rejectedPublicIds,
    failedIds,
  }
}
