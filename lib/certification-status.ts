import type { CertificationKind } from "@prisma/client"

// Status sertifikat & kepatuhan — fungsi murni, aman dipakai di server maupun
// klien. Tanggal dibandingkan per HARI (UTC tengah malam), sama seperti kolom
// @db.Date di database.

export type CertificateStatus = "AKTIF" | "SEGERA" | "KEDALUWARSA"
export type ComplianceStatus = "TERPENUHI" | "SEGERA" | "KEDALUWARSA" | "BELUM_ADA"

export const KIND_LABEL: Record<CertificationKind, string> = {
  SERTIFIKASI: "Sertifikasi",
  PELATIHAN: "Pelatihan",
}

export const CERTIFICATE_STATUS_LABEL: Record<CertificateStatus, string> = {
  AKTIF: "Berlaku",
  SEGERA: "Segera Kedaluwarsa",
  KEDALUWARSA: "Kedaluwarsa",
}

export const COMPLIANCE_STATUS_LABEL: Record<ComplianceStatus, string> = {
  TERPENUHI: "Terpenuhi",
  SEGERA: "Segera Kedaluwarsa",
  KEDALUWARSA: "Kedaluwarsa",
  BELUM_ADA: "Belum Ada",
}

const DAY_MS = 24 * 60 * 60 * 1000

export function startOfTodayUtc(now = new Date()) {
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
}

// Sisa hari sampai kedaluwarsa (0 = hari ini terakhir berlaku, negatif = lewat).
// null = berlaku selamanya.
export function daysUntil(expiry: Date | string | null, today = startOfTodayUtc()): number | null {
  if (!expiry) return null
  const e = typeof expiry === "string" ? new Date(`${expiry.slice(0, 10)}T00:00:00Z`) : expiry
  return Math.round((e.getTime() - today.getTime()) / DAY_MS)
}

export function certificateStatus(
  expiry: Date | string | null,
  reminderDays: number,
  today = startOfTodayUtc()
): CertificateStatus {
  const left = daysUntil(expiry, today)
  if (left === null) return "AKTIF"
  if (left < 0) return "KEDALUWARSA"
  if (left <= reminderDays) return "SEGERA"
  return "AKTIF"
}

// Tanggal kedaluwarsa bawaan dari tanggal terbit + masa berlaku (bulan).
// Mis. terbit 2025-03-10, 36 bulan → berlaku s.d. 2028-03-09.
export function defaultExpiryDate(issuedIso: string, validityMonths: number | null): string {
  if (!validityMonths || !/^\d{4}-\d{2}-\d{2}$/.test(issuedIso)) return ""
  const [y, m, d] = issuedIso.split("-").map(Number)
  const target = new Date(Date.UTC(y, m - 1 + validityMonths, d))
  // Kalau tanggalnya "meluap" (mis. 31 → bulan 30 hari), mundur ke akhir bulan target.
  if (target.getUTCDate() !== d) target.setUTCDate(0)
  target.setUTCDate(target.getUTCDate() - 1)
  return target.toISOString().slice(0, 10)
}

export function formatValidity(validityMonths: number | null) {
  if (!validityMonths) return "Berlaku selamanya"
  if (validityMonths % 12 === 0) return `${validityMonths / 12} tahun`
  return `${validityMonths} bulan`
}

// Dari beberapa sertifikat sejenis milik satu pegawai, yang menentukan
// kepatuhan adalah yang berlaku paling lama (tanpa batas > tanggal terjauh).
export function pickLatest<T extends { expiryDate: Date | null }>(items: T[]): T | undefined {
  return items.reduce<T | undefined>((best, item) => {
    if (!best) return item
    if (best.expiryDate === null) return best
    if (item.expiryDate === null) return item
    return item.expiryDate > best.expiryDate ? item : best
  }, undefined)
}
