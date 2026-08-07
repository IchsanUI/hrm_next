import { CredentialsSignin } from "next-auth"
import bcrypt from "bcryptjs"

import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity-log"

// Batas gagal password buat akun yang usernya VALID — begitu tercapai,
// akun dikunci langsung (User.lockedAt), tanpa auto-expire, cuma SUPER_ADMIN
// yang bisa buka lewat Manajemen Pengguna. Ini lapis PER-AKUN, terpisah dari
// lapis PER-IP di bawah.
export const MAX_PASSWORD_FAILURES = 5

// Waktu tunggu berjenjang per alamat IP — index 0 dipakai percobaan
// (distinct) ke-1, dst. Begitu jumlah percobaan melebihi panjang array ini
// (percobaan ke-4), IP-nya diblokir permanen.
const FAILED_LOGIN_COOLDOWNS_SECONDS = [30, 120, 300]

// Berapa banyak username gagal terakhir yang diingat per IP (buat dedupe —
// lihat komentar di schema.prisma pada LoginIpBlock.recentFailedUsernames).
// Tidak perlu besar: begitu attempt ke-4 (distinct) bikin IP diblokir
// permanen, daftar sepanjang ini sudah lebih dari cukup.
const RECENT_USERNAMES_LIMIT = 20

// Hash tetap (bukan rahasia, bukan dipakai buat autentikasi sungguhan) —
// cuma buat "mengisi waktu" bcrypt.compare ketika usernamenya tidak ada di
// database, supaya waktu respons attempt username-tidak-ada dan
// password-salah-di-akun-valid TIDAK bisa dibedakan lewat timing. Tanpa ini,
// attempt username-tidak-ada akan selalu lebih cepat (skip bcrypt sama
// sekali) — celah enumerasi lewat response time walau pesan errornya sudah
// disamakan.
const TIMING_SAFE_DUMMY_HASH =
  "$2b$10$cWgXwG6Lq87gdvL.3XTmf.jnCR/bg3aHfJ0mBsWhebhXRipLJ3qum"

export async function paceTimingForUnknownUser(): Promise<void> {
  await bcrypt.compare("timing-safety-dummy-compare", TIMING_SAFE_DUMMY_HASH)
}

// Pesan generik yang SAMA PERSIS dipakai di semua jalur kegagalan awal
// (username tidak ada / password salah) — sengaja tidak dibedakan sedikit
// pun, supaya tidak ada celah user-enumeration lewat isi pesan. Jangan ganti
// salah satu tanpa mengganti semuanya.
const GENERIC_LOGIN_FAILURE_MESSAGE = "Username atau password salah."

export class AccountLockedError extends CredentialsSignin {
  code = "account_locked"
}

export class IpBlockedError extends CredentialsSignin {
  code = "ip_blocked"
}

export class IpCooldownError extends CredentialsSignin {
  code = "ip_cooldown"
}

// Password sudah benar tapi akun ini (SUPER_ADMIN dengan 2FA aktif) belum
// mengirim kode TOTP/pemulihan sama sekali di request ini — belum tentu
// user salah apa-apa, jadi TIDAK dihitung sebagai percobaan gagal. Client
// (loginAction) menangkap code ini untuk menampilkan step kedua form.
export class TwoFactorRequiredError extends CredentialsSignin {
  code = "totp_required"
}

// Kode TOTP/pemulihan yang dikirim salah — beda dari TwoFactorRequiredError
// (belum ada kode sama sekali). Dihitung sebagai percobaan gagal lewat
// mekanisme failedLoginCount/lockedAt yang sama dengan password salah.
export class TwoFactorInvalidError extends CredentialsSignin {
  code = "totp_invalid"
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
// dicoba (valid maupun tidak — pesannya generik, tidak membedakan).
export async function assertIpNotBlocked(ip: string): Promise<void> {
  if (ip === "unknown") return // gagal deteksi IP — jangan sampai satu bucket "unknown" memblokir semua orang

  const block = await prisma.loginIpBlock.findUnique({ where: { ip } })
  if (!block) return

  if (block.permanentlyBlocked) {
    throw new IpBlockedError(
      "Akses dari alamat IP Anda diblokir karena terlalu banyak percobaan login gagal. Hubungi Super Admin untuk membuka."
    )
  }

  if (block.blockedUntil && block.blockedUntil > new Date()) {
    const waitSeconds = Math.ceil((block.blockedUntil.getTime() - Date.now()) / 1000)
    throw new IpCooldownError(
      `Terlalu banyak percobaan login. Coba lagi dalam ${formatWait(waitSeconds)}.`
    )
  }
}

function parseRecentUsernames(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((v): v is string => typeof v === "string")
}

// Catat kegagalan login dari IP ini untuk username tertentu. TIDAK throw —
// dipanggil dari dua tempat berbeda (lihat registerFailedLoginAttempt dan
// auth.ts saat akun sampai terkunci) yang masing-masing perlu melempar error
// dengan pesan berbeda setelahnya.
//
// Kalau username ini SUDAH pernah gagal dari IP yang sama sebelumnya (mis.
// satu orang salah ketik password berkali-kali di akun MILIKNYA SENDIRI),
// percobaan ini TIDAK menambah counter — sudah cukup ditangani lockout
// per-akun (User.lockedAt setelah MAX_PASSWORD_FAILURES). Counter di sini
// cuma naik kalau IP yang sama mulai gagal di username BARU yang belum
// pernah dicoba — pola yang mengindikasikan seseorang sengaja menyasar
// banyak akun berbeda dari satu sumber (atau menebak-nebak username yang
// tidak ada), bukan satu orang lupa password sendiri.
async function recordFailedLoginAttempt(ip: string, username: string): Promise<void> {
  if (ip === "unknown") return

  const existing = await prisma.loginIpBlock.findUnique({ where: { ip } })
  const recentUsernames = parseRecentUsernames(existing?.recentFailedUsernames)
  const isNewTarget = !recentUsernames.includes(username)
  const updatedRecentUsernames = isNewTarget
    ? [...recentUsernames, username].slice(-RECENT_USERNAMES_LIMIT)
    : recentUsernames

  if (!isNewTarget) {
    // Bukan target baru — cuma perbarui lastUsername/recentFailedUsernames,
    // tidak menaikkan failedAttemptCount ataupun cooldown.
    await prisma.loginIpBlock.upsert({
      where: { ip },
      create: { ip, recentFailedUsernames: updatedRecentUsernames, lastUsername: username },
      update: { recentFailedUsernames: updatedRecentUsernames, lastUsername: username },
    })
    return
  }

  const attemptCount = (existing?.failedAttemptCount ?? 0) + 1

  if (attemptCount > FAILED_LOGIN_COOLDOWNS_SECONDS.length) {
    await prisma.loginIpBlock.upsert({
      where: { ip },
      create: {
        ip,
        failedAttemptCount: attemptCount,
        recentFailedUsernames: updatedRecentUsernames,
        permanentlyBlocked: true,
        lastUsername: username,
      },
      update: {
        failedAttemptCount: attemptCount,
        recentFailedUsernames: updatedRecentUsernames,
        permanentlyBlocked: true,
        blockedUntil: null,
        lastUsername: username,
      },
    })
    await logActivity({
      username: "system",
      action: "LOGIN_FAILED",
      entityType: "Auth",
      description: `IP ${ip} diblokir permanen setelah gagal login ke ${attemptCount} akun/username berbeda (terakhir: "${username}").`,
    })
    return
  }

  const waitSeconds = FAILED_LOGIN_COOLDOWNS_SECONDS[attemptCount - 1]!
  const blockedUntil = new Date(Date.now() + waitSeconds * 1000)
  await prisma.loginIpBlock.upsert({
    where: { ip },
    create: {
      ip,
      failedAttemptCount: attemptCount,
      recentFailedUsernames: updatedRecentUsernames,
      blockedUntil,
      lastUsername: username,
    },
    update: {
      failedAttemptCount: attemptCount,
      recentFailedUsernames: updatedRecentUsernames,
      blockedUntil,
      lastUsername: username,
    },
  })
  await logActivity({
    username: "system",
    action: "LOGIN_FAILED",
    entityType: "Auth",
    description: `IP ${ip} gagal login ke akun/username berbeda ke-${attemptCount} (terakhir dicoba: "${username}") — ditahan ${formatWait(waitSeconds)}.`,
  })
}

// Dipanggil untuk kegagalan login yang BELUM mengunci akun (username tidak
// ditemukan, atau password salah tapi belum mencapai MAX_PASSWORD_FAILURES)
// — selalu throw dengan pesan generik yang sama, terlepas dari IP-nya jadi
// kena cooldown atau tidak (lihat komentar di dalam soal kenapa waktu
// tunggunya sengaja tidak disebut di sini).
export async function registerFailedLoginAttempt(ip: string, username: string): Promise<never> {
  await recordFailedLoginAttempt(ip, username)
  throw new IpCooldownError(GENERIC_LOGIN_FAILURE_MESSAGE)
}

// Sama seperti recordFailedLoginAttempt, tapi dipanggil dari jalur yang
// SUDAH akan melempar AccountLockedError sendiri (password salah ke-5 kali)
// — percobaan ini tetap harus dicatat di lapis IP juga, tapi pesan ke user
// biar ditentukan pemanggilnya (lebih spesifik: akunnya sendiri yang
// terkunci), bukan pesan generik dari sini.
export async function recordFailedAttemptForAccountLock(
  ip: string,
  username: string
): Promise<void> {
  await recordFailedLoginAttempt(ip, username)
}
