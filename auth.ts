import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"

import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity-log"
import { parseMenuAccess } from "@/lib/hr-menu-access"
import {
  AccountLockedError,
  MAX_PASSWORD_FAILURES,
  assertIpNotBlocked,
  getClientIp,
  paceTimingForUnknownUser,
  recordFailedAttemptForAccountLock,
  registerFailedLoginAttempt,
} from "@/lib/auth/login-security"
import authConfig from "@/auth.config"

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  session: {
    strategy: "jwt",
    // Default NextAuth 30 hari kelamaan buat HRIS internal — device yang
    // hilang/dipinjam bisa tetap punya sesi aktif berminggu-minggu. Dipakai
    // sebagai sliding idle-timeout: token diperpanjang otomatis (maxAge lagi
    // dari sekarang) tiap ada aktivitas dalam 5 menit terakhir (updateAge) —
    // jadi user yang aktif TIDAK ke-logout tiap 30 menit, tapi begitu device
    // benar-benar idle (mis. lupa logout, laptop ditinggal) lebih dari 30
    // menit, sesinya otomatis mati dan wajib login ulang.
    maxAge: 30 * 60,
    updateAge: 5 * 60,
  },
  providers: [
    Credentials({
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials, request) => {
        const username = credentials?.username as string | undefined
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
        }
      },
    }),
  ],
})
