import { prisma } from "@/lib/prisma"
import {
  SESSION_IDLE_DEFAULT_MINUTES,
  SESSION_IDLE_MAX_MINUTES,
  SESSION_IDLE_MIN_MINUTES,
  SESSION_WARNING_DEFAULT_SECONDS,
  SESSION_WARNING_MAX_SECONDS,
  SESSION_WARNING_MIN_SECONDS,
} from "@/lib/session-idle"

// Durasi logout otomatis yang berlaku (server-only). Dibaca di callback jwt
// tiap request → cache singkat di memori, dibuang langsung saat Super Admin
// menyimpan perubahan (invalidateSessionPolicyCache).

export type SessionPolicyValues = { idleMinutes: number; warningSeconds: number }

const CACHE_TTL_MS = 60_000
let cached: { value: SessionPolicyValues; at: number } | null = null

export async function getSessionPolicy(): Promise<SessionPolicyValues> {
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.value
  const row = await prisma.sessionPolicy.findUnique({ where: { id: 1 } })
  const idleMinutes = Math.min(
    SESSION_IDLE_MAX_MINUTES,
    Math.max(SESSION_IDLE_MIN_MINUTES, row?.idleMinutes ?? SESSION_IDLE_DEFAULT_MINUTES)
  )
  // Peringatan harus muncul sebelum logout — maksimal separuh durasi idle.
  const warningSeconds = Math.min(
    SESSION_WARNING_MAX_SECONDS,
    (idleMinutes * 60) / 2,
    Math.max(SESSION_WARNING_MIN_SECONDS, row?.warningSeconds ?? SESSION_WARNING_DEFAULT_SECONDS)
  )
  const value = { idleMinutes, warningSeconds }
  cached = { value, at: Date.now() }
  return value
}

export function invalidateSessionPolicyCache() {
  cached = null
}
