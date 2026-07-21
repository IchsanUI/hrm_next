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
  registerUnknownUsernameAttempt,
} from "@/lib/auth/login-security"
import authConfig from "@/auth.config"

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  session: { strategy: "jwt" },
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
          await logActivity({
            username,
            action: "LOGIN_FAILED",
            entityType: "Auth",
            description: `Percobaan login gagal untuk username "${username}" (akun tidak ditemukan) dari IP ${ip}.`,
          })
          await registerUnknownUsernameAttempt(ip, username)
          return null // registerUnknownUsernameAttempt selalu throw — baris ini cuma buat narrowing TS
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
            throw new AccountLockedError(
              "Akun Anda dikunci karena terlalu banyak percobaan gagal. Hubungi Super Admin untuk membuka."
            )
          }
          return null
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
