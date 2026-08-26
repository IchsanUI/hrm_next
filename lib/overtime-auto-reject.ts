import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity-log"
import { createNotification } from "@/lib/notifications"

// Aturan: pengajuan Izin Lembur otomatis DITOLAK kalau step PERTAMA (Atasan
// Langsung/Kepala Departemen — order=1) belum diproses dalam 24 jam sejak
// diajukan. Sengaja CUMA step pertama yang punya deadline ini — begitu
// atasan langsung approve, itu sudah jadi fakta operasional (stafnya
// memang lembur dengan sepengetahuan atasan) yang tidak boleh dibatalkan
// lagi gara-gara approver berikutnya (mis. Direksi) lambat memproses.
// Lihat diskusi soal ini di riwayat chat — bukan aturan generik yang
// berlaku ke SEMUA jenis izin, khusus Lembur.
const AUTO_REJECT_AFTER_MS = 24 * 60 * 60 * 1000
const AUTO_REJECT_REASON =
  "Otomatis ditolak sistem — tidak diproses Atasan Langsung dalam 24 jam sejak diajukan."

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

  const expiredRequests = await prisma.overtimeRequest.findMany({
    where: {
      status: "PENDING_APPROVAL",
      createdAt: { lte: cutoff },
      approvalSteps: { some: { order: 1, status: "IN_PROGRESS" } },
    },
    include: {
      employee: { select: { fullName: true, user: { select: { id: true } } } },
      approvalSteps: { where: { order: 1, status: "IN_PROGRESS" } },
    },
  })

  const rejectedPublicIds: string[] = []
  const failedIds: number[] = []

  for (const request of expiredRequests) {
    const firstStep = request.approvalSteps[0]
    if (!firstStep) continue // dijaga sama WHERE di atas, cuma jaga-jaga race condition

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
          message: `Pengajuan izin lembur Anda untuk tanggal ${request.date.toLocaleDateString("id-ID")} otomatis ditolak karena tidak diproses Atasan Langsung dalam 24 jam.`,
          link: `/pegawai/riwayat-izin/${request.publicId}`,
        })
      }

      await logActivity({
        userId: null,
        username: "system",
        action: "UPDATE",
        entityType: "OvertimeRequest",
        description: `Sistem menolak otomatis izin lembur (${request.id}) milik "${request.employee.fullName}" — kedaluwarsa 24 jam tanpa diproses Atasan Langsung.`,
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
