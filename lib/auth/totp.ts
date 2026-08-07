import { generateSecret, generateURI, verify } from "otplib"

const ISSUER = "HRIS"

export function generateTotpSecret(): string {
  return generateSecret()
}

export function buildOtpAuthUri(secret: string, username: string): string {
  return generateURI({ issuer: ISSUER, label: username, secret })
}

// Toleransi ±30 detik buat jam device authenticator yang sedikit meleset —
// tanpa ini kode yang "baru saja" berganti gara-gara drift kecil bisa
// ditolak padahal seharusnya masih valid.
export async function verifyTotpCode(token: string, secret: string): Promise<boolean> {
  try {
    const result = await verify({ token, secret, epochTolerance: 30 })
    return result.valid
  } catch {
    return false
  }
}
