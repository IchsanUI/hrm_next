// Tampilan halaman login — tipe & nilai bawaan yang aman dipakai di komponen
// klien (tanpa prisma). Logika server: lib/login-appearance.ts.

export type LoginWallpaperView = {
  id: number
  imageUrl: string
  label: string | null
  focusX: number // 0–100 (%)
  focusY: number
  isActive: boolean
  sortOrder: number
}

export type LoginAppearance = {
  wallpapers: Pick<LoginWallpaperView, "id" | "imageUrl" | "focusX" | "focusY">[]
  slideSeconds: number
  taglineWords: string[]
}

export const LOGIN_SLIDE_SECONDS = { min: 4, max: 60, default: 9 } as const
export const LOGIN_TAGLINE_LIMITS = { maxWords: 12, maxLength: 30 } as const
export const LOGIN_WALLPAPER_MAX_BYTES = 8 * 1024 * 1024
export const LOGIN_WALLPAPER_MAX_COUNT = 10

// Dipakai bila belum ada pengaturan sama sekali (mis. database baru).
export const LOGIN_APPEARANCE_FALLBACK: LoginAppearance = {
  wallpapers: [{ id: 0, imageUrl: "/login-hero.webp", focusX: 75, focusY: 30 }],
  slideSeconds: LOGIN_SLIDE_SECONDS.default,
  taglineWords: ["Kepegawaian", "Absensi", "Izin", "Payroll", "Perpustakaan", "Klaim Kesehatan"],
}

// Gambar unggahan disimpan di sini (boleh dihapus file-nya); gambar bawaan
// di public/ hanya dilepas dari daftar, file-nya tetap ada.
export const LOGIN_UPLOAD_PREFIX = "/uploads/login/"

export function isUploadedWallpaper(url: string) {
  return url.startsWith(LOGIN_UPLOAD_PREFIX)
}

export function focusToPosition(focusX: number, focusY: number) {
  return `${focusX}% ${focusY}%`
}
