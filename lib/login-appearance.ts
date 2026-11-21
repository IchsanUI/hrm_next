import { prisma } from "@/lib/prisma"
import {
  LOGIN_APPEARANCE_FALLBACK,
  LOGIN_SLIDE_SECONDS,
  type LoginAppearance,
} from "@/lib/login-appearance-shared"

// Tampilan halaman login yang berlaku (server-only). Halaman login dibuka
// tanpa sesi & cukup sering → cache singkat di memori, dibuang langsung saat
// Super Admin menyimpan perubahan (invalidateLoginAppearanceCache).
const CACHE_TTL_MS = 60_000
let cached: { value: LoginAppearance; at: number } | null = null

export function parseTaglineWords(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((w): w is string => typeof w === "string" && w.trim().length > 0).map((w) => w.trim())
}

export async function getLoginAppearance(): Promise<LoginAppearance> {
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.value
  let value: LoginAppearance
  try {
    const [wallpapers, settings] = await Promise.all([
      prisma.loginWallpaper.findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        select: { id: true, imageUrl: true, focusX: true, focusY: true },
      }),
      prisma.loginSettings.findUnique({ where: { id: 1 } }),
    ])
    const words = parseTaglineWords(settings?.taglineWords)
    value = {
      wallpapers: wallpapers.length ? wallpapers : LOGIN_APPEARANCE_FALLBACK.wallpapers,
      slideSeconds: Math.min(
        LOGIN_SLIDE_SECONDS.max,
        Math.max(LOGIN_SLIDE_SECONDS.min, settings?.slideSeconds ?? LOGIN_SLIDE_SECONDS.default)
      ),
      taglineWords: words.length ? words : LOGIN_APPEARANCE_FALLBACK.taglineWords,
    }
  } catch (error) {
    // Halaman login tidak boleh ikut error hanya karena pengaturan tampilan.
    console.error("Gagal membaca tampilan login:", error)
    value = LOGIN_APPEARANCE_FALLBACK
  }
  cached = { value, at: Date.now() }
  return value
}

export function invalidateLoginAppearanceCache() {
  cached = null
}
