import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"

import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity-log"
import { parseMenuAccess } from "@/lib/hr-menu-access"
import {
  AccountLockedError,
  MAX_PASSWORD_FAILURES,
  TwoFactorInvalidError,
  TwoFactorRequiredError,
  assertIpNotBlocked,
  getClientIp,
  paceTimingForUnknownUser,
  recordFailedAttemptForAccountLock,
  registerFailedLoginAttempt,
} from "@/lib/auth/login-security"
import { decryptTotpSecret } from "@/lib/auth/totp-encryption"
import { verifyTotpCode } from "@/lib/auth/totp"
import { verifyAndConsumeRecoveryCode } from "@/lib/auth/totp-recovery-codes"
import authConfig from "@/auth.config"
import { SESSION_IDLE_MAX_MINUTES, SESSION_SERVER_GRACE_MINUTES } from "@/lib/session-idle"
import { computePasswordStatus, getPasswordPolicy, passwordActionFor } from "@/lib/password-policy"

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  session: {
    strategy: "jwt",
    // Default NextAuth 30 hari kelamaan buat HRIS internal. maxAge di sini
    // hanya BATAS ATAS (durasi idle tertinggi yang boleh diatur + kelonggaran);
    // logout karena tidak aktif yang sebenarnya mengikuti pengaturan Super
    // Admin (SessionPolicy) dan dicek di callback jwt (auth.config.ts) +
    // SessionIdleGuard di client. Lihat lib/session-idle.ts.
    maxAge: (SESSION_IDLE_MAX_MINUTES + SESSION_SERVER_GRACE_MINUTES) * 60,
    updateAge: 60,
  },
  providers: [
    Credentials({
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
        totp: { label: "Kode 2FA", type: "text" },
        recoveryCode: { label: "Kode Pemulihan", type: "text" },
      },
      authorize: async (credentials, request) => {
        // .trim() jaga-jaga di DUA sisi (input login DAN data akun sendiri
        // sudah di-trim juga saat dibuat/diubah, lihat employeeFormSchema &
        // updateUsernameSchema) — exact-match lookup di bawah ini sama
        // sekali tidak toleran whitespace, insiden nyata pernah bikin akun
        // tidak bisa login sama sekali walau password yang diketik benar.
        const usernameRaw = credentials?.username as string | undefined
        const username = usernameRaw?.trim()
        const password = credentials?.password as string | undefined
        if (!username || !password) return null

        const ip = getClientIp(request)
        await assertIpNotBlocked(ip)

        const user = await prisma.user.findUnique({
          where: { username },
          include: { role: true },
        })
        if (!user) {
          // Tetap jalankan bcrypt (terhadap hash dummy) walau usernya tidak
          // ada — supaya waktu respons attempt "username tidak ada" tidak
          // bisa dibedakan dari "password salah di akun valid" lewat timing
          // (lihat komentar TIMING_SAFE_DUMMY_HASH di login-security.ts).
          await paceTimingForUnknownUser()
          await logActivity({
            username,
            action: "LOGIN_FAILED",
            entityType: "Auth",
            description: `Percobaan login gagal untuk username "${username}" (akun tidak ditemukan) dari IP ${ip}.`,
          })
          await registerFailedLoginAttempt(ip, username)
          return null // registerFailedLoginAttempt selalu throw — baris ini cuma buat narrowing TS
        }

        if (!user.isActive) {
          await logActivity({
            userId: user.id,
            username: user.username,
            action: "LOGIN_FAILED",
            entityType: "Auth",
            description: `Percobaan login gagal untuk "${user.username}" (akun nonaktif).`,
          })
          return null
        }

        if (user.lockedAt) {
          await logActivity({
            userId: user.id,
            username: user.username,
            action: "LOGIN_FAILED",
            entityType: "Auth",
            description: `Percobaan login ke akun "${user.username}" yang sedang terkunci, dari IP ${ip}.`,
          })
          throw new AccountLockedError(
            "Akun Anda dikunci karena terlalu banyak percobaan gagal. Hubungi Super Admin untuk membuka."
          )
        }

        const isValid = await bcrypt.compare(password, user.password)
        if (!isValid) {
          const failedLoginCount = user.failedLoginCount + 1
          const shouldLock = failedLoginCount >= MAX_PASSWORD_FAILURES
          await prisma.user.update({
            where: { id: user.id },
            data: { failedLoginCount, lockedAt: shouldLock ? new Date() : undefined },
          })
          await logActivity({
            userId: user.id,
            username: user.username,
            action: "LOGIN_FAILED",
            entityType: "Auth",
            description: `Percobaan login gagal untuk "${user.username}" (password salah, ${failedLoginCount}/${MAX_PASSWORD_FAILURES}) dari IP ${ip}.`,
          })
          if (shouldLock) {
            await logActivity({
              userId: user.id,
              username: user.username,
              action: "UPDATE",
              entityType: "User",
              description: `Akun "${user.username}" otomatis dikunci setelah ${MAX_PASSWORD_FAILURES} kali gagal login berturut-turut.`,
            })
            await recordFailedAttemptForAccountLock(ip, username)
            throw new AccountLockedError(
              "Akun Anda dikunci karena terlalu banyak percobaan gagal. Hubungi Super Admin untuk membuka."
            )
          }
          await registerFailedLoginAttempt(ip, username)
          return null // registerFailedLoginAttempt selalu throw — baris ini cuma buat narrowing TS
        }

        if (user.failedLoginCount > 0) {
          await prisma.user.update({ where: { id: user.id }, data: { failedLoginCount: 0 } })
        }

        // 2FA — cuma digerbang untuk SUPER_ADMIN yang SUDAH menyelesaikan
        // enrollment (totpEnabledAt terisi). Sengaja cek totpEnabledAt, BUKAN
        // cuma totpSecret — secret bisa saja sudah di-generate (status
        // "pending" dari wizard setup yang belum dikonfirmasi/ditinggal),
        // dan pengguna belum tentu punya kode yang valid untuk itu.
        if (user.role.name === "SUPER_ADMIN" && user.totpEnabledAt && user.totpSecret) {
          const totpRaw = credentials?.totp as string | undefined
          const recoveryCodeRaw = credentials?.recoveryCode as string | undefined
          const totp = totpRaw?.trim()
          const recoveryCode = recoveryCodeRaw?.trim()

          if (!totp && !recoveryCode) {
            // Password sudah benar tapi kode 2FA belum dikirim — jangan buat
            // sesi, minta client tampilkan step kedua. TIDAK dihitung
            // sebagai percobaan gagal.
            throw new TwoFactorRequiredError("Masukkan kode 2FA.")
          }

          const secret = decryptTotpSecret(user.totpSecret)
          let totpOk = false
          if (totp) {
            totpOk = await verifyTotpCode(totp, secret)
          } else if (recoveryCode) {
            totpOk = await verifyAndConsumeRecoveryCode(user.id, recoveryCode)
            if (totpOk) {
              await logActivity({
                userId: user.id,
                username: user.username,
                action: "USE_2FA_RECOVERY_CODE",
                entityType: "User",
                description: `${user.username} login memakai kode pemulihan 2FA.`,
              })
            }
          }

          if (!totpOk) {
            // Kode TOTP/pemulihan salah — DIPERLAKUKAN SAMA seperti password
            // salah: ikut counter failedLoginCount/lockedAt yang sudah ada,
            // supaya tidak ada mekanisme brute-force kedua yang independen
            // dan tidak dijaga.
            const failedLoginCount = user.failedLoginCount + 1
            const shouldLock = failedLoginCount >= MAX_PASSWORD_FAILURES
            await prisma.user.update({
              where: { id: user.id },
              data: { failedLoginCount, lockedAt: shouldLock ? new Date() : undefined },
            })
            await logActivity({
              userId: user.id,
              username: user.username,
              action: "LOGIN_FAILED",
              entityType: "Auth",
              description: `Percobaan login gagal untuk "${user.username}" (kode 2FA salah, ${failedLoginCount}/${MAX_PASSWORD_FAILURES}) dari IP ${ip}.`,
            })
            if (shouldLock) {
              await logActivity({
                userId: user.id,
                username: user.username,
                action: "UPDATE",
                entityType: "User",
                description: `Akun "${user.username}" otomatis dikunci setelah ${MAX_PASSWORD_FAILURES} kali gagal login berturut-turut.`,
              })
              await recordFailedAttemptForAccountLock(ip, username)
              throw new AccountLockedError(
                "Akun Anda dikunci karena terlalu banyak percobaan gagal. Hubungi Super Admin untuk membuka."
              )
            }
            throw new TwoFactorInvalidError("Kode 2FA atau kode pemulihan salah.")
          }
        }

        await logActivity({
          userId: user.id,
          username: user.username,
          action: "LOGIN",
          entityType: "Auth",
          description: `${user.username} berhasil login.`,
        })

        return {
          id: String(user.id),
          username: user.username,
          role: user.role.name,
          employeeId: user.employeeId,
          menuAccess: parseMenuAccess(user.menuAccess),
          twoFactorEnabled: user.role.name === "SUPER_ADMIN" ? !!user.totpEnabledAt : true,
          // Password awal/reset atau kedaluwarsa → proxy.ts mengarahkan ke
          // /ganti-password (lib/password-policy.ts). Dicek SETELAH password
          // & TOTP lolos — TOTP tetap faktor terpisah.
          passwordAction: passwordActionFor(computePasswordStatus(user, await getPasswordPolicy())),
        }
      },
    }),
  ],
})
