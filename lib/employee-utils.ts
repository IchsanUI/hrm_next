import crypto from "crypto"

const CONTRACT_STATUSES = ["kontrak", "percobaan"]

export function computeContractEndDate(
  startDate: Date,
  employmentStatusName: string
): Date | null {
  if (!CONTRACT_STATUSES.includes(employmentStatusName.toLowerCase())) {
    return null
  }
  const end = new Date(startDate)
  end.setMonth(end.getMonth() + 3)
  return end
}

export function initialPasswordFromBirthDate(birthDate: Date): string {
  const yyyy = birthDate.getFullYear().toString().padStart(4, "0")
  const mm = (birthDate.getMonth() + 1).toString().padStart(2, "0")
  const dd = birthDate.getDate().toString().padStart(2, "0")
  return `${yyyy}${mm}${dd}`
}

// Karakter ambigu (0/O, 1/l/I) sengaja dibuang supaya password sementara ini
// mudah dibaca & diketik ulang manual oleh pegawai baru saat login pertama kali.
const PASSWORD_LOWER = "abcdefghijkmnopqrstuvwxyz"
const PASSWORD_UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ"
const PASSWORD_DIGIT = "23456789"

function randomChar(chars: string) {
  return chars[crypto.randomInt(chars.length)]
}

// Password sementara acak (bukan berbasis tanggal lahir yang mudah ditebak),
// dipakai saat admin membuat akun pegawai baru. Hanya ditampilkan sekali ke
// admin langsung setelah dibuat — yang tersimpan di database cuma hash-nya.
export function generateSecurePassword(length = 12): string {
  const all = PASSWORD_LOWER + PASSWORD_UPPER + PASSWORD_DIGIT
  const required = [
    randomChar(PASSWORD_LOWER),
    randomChar(PASSWORD_UPPER),
    randomChar(PASSWORD_DIGIT),
  ]
  const rest = Array.from({ length: Math.max(length - required.length, 0) }, () =>
    randomChar(all)
  )
  const combined = [...required, ...rest]

  for (let i = combined.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1)
    ;[combined[i], combined[j]] = [combined[j], combined[i]]
  }

  return combined.join("")
}
