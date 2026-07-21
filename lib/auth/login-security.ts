import { CredentialsSignin } from "next-auth"

import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity-log"

// Batas gagal password buat akun yang usernya VALID — begitu tercapai,
// akun dikunci langsung (User.lockedAt), tanpa auto-expire, cuma SUPER_ADMIN
// yang bisa buka lewat Manajemen Pengguna.
export const MAX_PASSWORD_FAILURES = 5

// Waktu tunggu berjenjang buat percobaan login dengan username yang TIDAK
// ADA di database, per IP — index 0 dipakai percobaan ke-1, dst. Begitu
// jumlah percobaan melebihi panjang array ini (percobaan ke-4), IP-nya
// diblokir permanen.
const UNKNOWN_USERNAME_COOLDOWNS_SECONDS = [30, 120, 300]

export class AccountLockedError extends CredentialsSignin {
  code = "account_locked"
}

export class IpBlockedError extends CredentialsSignin {
  code = "ip_blocked"
}

export class IpCooldownError extends CredentialsSignin {
  code = "ip_cooldown"
}

export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for")
  if (forwardedFor) return forwardedFor.split(",")[0]!.trim()
  const realIp = request.headers.get("x-real-ip")
  if (realIp) return realIp.trim()
  return "unknown"
}

function formatWait(seconds: number): string {
  if (seconds < 60) return `${seconds} detik`
  return `${Math.ceil(seconds / 60)} menit`
}

// Dipanggil di awal authorize(), sebelum lookup username — supaya IP yang
// lagi dalam cooldown/blokir permanen ditolak duluan, apapun username yang
// dicoba.
export async function assertIpNotBlocked(ip: string): Promise<void> {
  if (ip === "unknown") return // gagal deteksi IP — jangan sampai satu bucket "unknown" memblokir semua orang

  const block = await prisma.loginIpBlock.findUnique({ where: { ip } })
  if (!block) return

  if (block.permanentlyBlocked) {
    throw new IpBlockedError(
      "Akses dari alamat IP Anda diblokir karena berulang kali memasukkan username yang tidak terdaftar. Hubungi Super Admin untuk membuka."
    )
  }

  if (block.blockedUntil && block.blockedUntil > new Date()) {
    const waitSeconds = Math.ceil((block.blockedUntil.getTime() - Date.now()) / 1000)
    throw new IpCooldownError(
      `Terlalu banyak percobaan login. Coba lagi dalam ${formatWait(waitSeconds)}.`
    )
  }
}

// Dipanggil begitu username yang diketik TIDAK ditemukan di database. Selalu
// throw (tidak pernah return normal) — makin sering diulang dari IP yang
// sama, makin lama waktu tunggunya, sampai akhirnya diblokir permanen.
export async function registerUnknownUsernameAttempt(
  ip: string,
  username: string
): Promise<never> {
  if (ip === "unknown") {
    throw new IpCooldownError("Username atau password salah.")
  }

  const existing = await prisma.loginIpBlock.findUnique({ where: { ip } })
  const attemptCount = (existing?.unknownAttemptCount ?? 0) + 1

  if (attemptCount > UNKNOWN_USERNAME_COOLDOWNS_SECONDS.length) {
    await prisma.loginIpBlock.upsert({
      where: { ip },
      create: { ip, unknownAttemptCount: attemptCount, permanentlyBlocked: true, lastUsername: username },
      update: { unknownAttemptCount: attemptCount, permanentlyBlocked: true, blockedUntil: null, lastUsername: username },
    })
    await logActivity({
      username: "system",
      action: "LOGIN_FAILED",
      entityType: "Auth",
      description: `IP ${ip} diblokir permanen setelah ${attemptCount} kali mencoba login dengan username tak terdaftar (terakhir: "${username}").`,
    })
    throw new IpBlockedError(
      "Akses dari alamat IP Anda diblokir karena berulang kali memasukkan username yang tidak terdaftar. Hubungi Super Admin untuk membuka."
    )
  }

  const waitSeconds = UNKNOWN_USERNAME_COOLDOWNS_SECONDS[attemptCount - 1]!
  const blockedUntil = new Date(Date.now() + waitSeconds * 1000)
  await prisma.loginIpBlock.upsert({
    where: { ip },
    create: { ip, unknownAttemptCount: attemptCount, blockedUntil, lastUsername: username },
    update: { unknownAttemptCount: attemptCount, blockedUntil, lastUsername: username },
  })
  await logActivity({
    username: "system",
    action: "LOGIN_FAILED",
    entityType: "Auth",
    description: `IP ${ip} mencoba login dengan username tak terdaftar "${username}" (percobaan ke-${attemptCount}) — ditahan ${formatWait(waitSeconds)}.`,
  })
  throw new IpCooldownError(
    `Username tidak ditemukan. Coba lagi dalam ${formatWait(waitSeconds)}.`
  )
}
