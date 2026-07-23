import { prisma } from "@/lib/prisma"

// Golongan yang boleh dipilih di dropdown pegawai HARUS sinkron dengan yang
// tampil di Struktur & Golongan Gaji — cuma golongan yang punya rate di
// versi Skala Gaji PP yang sedang AKTIF. Kalau belum ada versi aktif,
// daftarnya kosong (lihat app/admin/payroll/struktur-gaji/page.tsx).
export async function getActiveSalaryGrades() {
  const activeVersion = await prisma.salaryScaleVersion.findFirst({ where: { isActive: true } })
  if (!activeVersion) return []

  return prisma.salaryGrade.findMany({
    where: { isActive: true, rates: { some: { versionId: activeVersion.id } } },
    orderBy: [{ displayOrder: "asc" }, { code: "asc" }, { subGrade: "asc" }],
  })
}
