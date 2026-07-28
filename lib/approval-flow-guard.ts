import { prisma } from "@/lib/prisma"

// Approver ID hasil resolve alur approval datang dari data REFERENSI
// (Department.headEmployeeId, ApprovalFlowStep.approverEmployeeId) yang
// BISA basi kalau pegawainya sudah dihapus tapi referensinya belum sempat
// dibersihkan (lihat insiden dangling Department.headEmployeeId setelah
// bulk-delete data pegawai) — beda dari kasus "tidak ada approver sama
// sekali" (sudah ditangani per jenis izin lewat firstActiveIndex === -1).
// Tanpa pengecekan ini, approverId basi lolos sampai ke Prisma .create()
// dan meledak sebagai PrismaClientKnownRequestError mentah (FK constraint
// violated) alih-alih pesan yang jelas ke pegawai.
export async function findInvalidApproverIds(candidateIds: (number | null)[]): Promise<number[]> {
  const uniqueIds = Array.from(new Set(candidateIds.filter((id): id is number => id !== null)))
  if (uniqueIds.length === 0) return []
  const existing = await prisma.employee.findMany({ where: { id: { in: uniqueIds } }, select: { id: true } })
  const existingSet = new Set(existing.map((e) => e.id))
  return uniqueIds.filter((id) => !existingSet.has(id))
}
