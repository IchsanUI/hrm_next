import bcrypt from "bcryptjs"

import { prisma } from "@/lib/prisma"

// Masa berlaku & riwayat password — PADK OJK 43/PADK.03/2025 Lampiran I
// (Pengamanan Logic). Spesifikasi: docs/prd-masa-berlaku-password.md.
//
// Tenggat = max(passwordChangedAt, effectiveAt) + intervalDays.
// - intervalDays kosong ATAU effectiveAt kosong/belum tiba → kebijakan belum
//   berlaku (NOT_ENFORCED). Nilai interval WAJIB dari kebijakan bank.
// - max(..., effectiveAt) membuat akun lama (passwordChangedAt = tanggal
//   migrasi) mendapat interval PENUH sejak kebijakan berlaku, tidak terkunci
//   serentak di hari aktivasi.
// - mustChangePassword (password awal / reset admin) SELALU berlaku, tidak
//   bergantung interval.

export type PasswordPolicyValues = {
  intervalDays: number | null
  warningDays: number
  historyCount: number
  effectiveAt: Date | null
}

export type PasswordState = "MUST_CHANGE" | "EXPIRED" | "WARNING" | "ACTIVE" | "NOT_ENFORCED"

export type PasswordStatus = {
  state: PasswordState
  dueAt: Date | null
  daysLeft: number | null
}

// Aksi wajib yang dibawa di token sesi → proxy.ts memblokir akses lain.
export type PasswordAction = "MUST_CHANGE" | "EXPIRED"

const DEFAULT_POLICY: PasswordPolicyValues = { intervalDays: null, warningDays: 14, historyCount: 5, effectiveAt: null }
const DAY_MS = 86_400_000

// Dibaca di callback jwt (tiap request) — cache singkat di memori supaya
// tidak menambah query tiap request. Perubahan dari halaman kebijakan
// langsung membuang cache ini (invalidatePasswordPolicyCache).
const CACHE_TTL_MS = 60_000
let cached: { value: PasswordPolicyValues; at: number } | null = null

export async function getPasswordPolicy(): Promise<PasswordPolicyValues> {
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.value
  const row = await prisma.passwordPolicy.findUnique({ where: { id: 1 } })
  const value: PasswordPolicyValues = row
    ? {
        intervalDays: row.intervalDays,
        warningDays: row.warningDays,
        historyCount: row.historyCount,
        effectiveAt: row.effectiveAt,
      }
    : DEFAULT_POLICY
  cached = { value, at: Date.now() }
  return value
}

export function invalidatePasswordPolicyCache() {
  cached = null
}

export function isPolicyEnforced(policy: PasswordPolicyValues, now = new Date()) {
  return !!policy.intervalDays && !!policy.effectiveAt && now >= policy.effectiveAt
}

export function computePasswordStatus(
  user: { passwordChangedAt: Date; mustChangePassword: boolean },
  policy: PasswordPolicyValues,
  now = new Date()
): PasswordStatus {
  if (user.mustChangePassword) return { state: "MUST_CHANGE", dueAt: null, daysLeft: null }
  if (!isPolicyEnforced(policy, now)) return { state: "NOT_ENFORCED", dueAt: null, daysLeft: null }

  const effectiveAt = policy.effectiveAt as Date
  const base = user.passwordChangedAt > effectiveAt ? user.passwordChangedAt : effectiveAt
  const dueAt = new Date(base.getTime() + (policy.intervalDays as number) * DAY_MS)
  const msLeft = dueAt.getTime() - now.getTime()
  if (msLeft <= 0) return { state: "EXPIRED", dueAt, daysLeft: 0 }
  const daysLeft = Math.ceil(msLeft / DAY_MS)
  return { state: daysLeft <= policy.warningDays ? "WARNING" : "ACTIVE", dueAt, daysLeft }
}

export function passwordActionFor(status: PasswordStatus): PasswordAction | null {
  return status.state === "MUST_CHANGE" || status.state === "EXPIRED" ? status.state : null
}

// ---- Riwayat password ------------------------------------------------------

// true kalau newPassword sama dengan password yang sedang dipakai ATAU salah
// satu dari (historyCount - 1) password sebelumnya. Hanya membandingkan hash.
export async function isPasswordReused(
  userId: number,
  currentHash: string,
  newPassword: string,
  historyCount: number
): Promise<boolean> {
  if (await bcrypt.compare(newPassword, currentHash)) return true
  const previousToCheck = Math.max(0, historyCount - 1)
  if (previousToCheck === 0) return false
  const history = await prisma.passwordHistory.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: previousToCheck,
    select: { password: true },
  })
  for (const h of history) {
    if (await bcrypt.compare(newPassword, h.password)) return true
  }
  return false
}

type HistoryClient = Pick<typeof prisma, "passwordHistory">

// Simpan hash password LAMA ke riwayat, lalu pangkas ke batas kebijakan
// (minimal 1 baris supaya masih ada jejak saat batas dinaikkan lagi).
export async function recordPasswordHistory(db: HistoryClient, userId: number, oldHash: string, historyCount: number) {
  await db.passwordHistory.create({ data: { userId, password: oldHash } })
  const keep = Math.max(1, historyCount)
  const stale = await db.passwordHistory.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    skip: keep,
    select: { id: true },
  })
  if (stale.length) await db.passwordHistory.deleteMany({ where: { id: { in: stale.map((s) => s.id) } } })
}

// Password tidak boleh memuat username / NIP (PADK: password berkualitas).
export function containsIdentity(newPassword: string, identities: (string | null | undefined)[]) {
  const lower = newPassword.toLowerCase()
  return identities.some((id) => !!id && id.length >= 3 && lower.includes(id.toLowerCase()))
}
