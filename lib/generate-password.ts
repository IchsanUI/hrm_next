// Generator password acak yang jalan di BROWSER (Web Crypto API) — beda dari
// lib/employee-utils.ts generateSecurePassword yang pakai Node crypto dan
// cuma jalan di server. Dipakai tombol "Generate" di dialog reset password
// (Manajemen Pengguna) supaya admin tidak perlu mengarang password sendiri.
// Selalu menyertakan karakter spesial (beda dari generator server) karena
// password reset lewat sini divalidasi passwordRules.hasSpecial.
const LOWER = "abcdefghijkmnopqrstuvwxyz" // tanpa 'l' — gampang ketuker sama '1'
const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ" // tanpa 'I'/'O' — gampang ketuker sama '1'/'0'
const DIGIT = "23456789"
const SPECIAL = "!@#$%^&*"

function randomInt(max: number): number {
  const arr = new Uint32Array(1)
  crypto.getRandomValues(arr)
  return arr[0] % max
}

function randomChar(chars: string) {
  return chars[randomInt(chars.length)]
}

export function generateClientPassword(length = 12): string {
  const all = LOWER + UPPER + DIGIT + SPECIAL
  const required = [randomChar(LOWER), randomChar(UPPER), randomChar(DIGIT), randomChar(SPECIAL)]
  const rest = Array.from({ length: Math.max(length - required.length, 0) }, () => randomChar(all))
  const combined = [...required, ...rest]

  for (let i = combined.length - 1; i > 0; i--) {
    const j = randomInt(i + 1)
    ;[combined[i], combined[j]] = [combined[j], combined[i]]
  }

  return combined.join("")
}
