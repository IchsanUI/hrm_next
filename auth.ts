import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"

import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity-log"
import { parseMenuAccess } from "@/lib/hr-menu-access"
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
      authorize: async (credentials) => {
        const username = credentials?.username as string | undefined
        const password = credentials?.password as string | undefined
        if (!username || !password) return null

        const user = await prisma.user.findUnique({
          where: { username },
          include: { role: true },
        })
        if (!user || !user.isActive) {
          await logActivity({
            username,
            action: "LOGIN_FAILED",
            entityType: "Auth",
            description: `Percobaan login gagal untuk username "${username}" (akun tidak ditemukan/nonaktif).`,
          })
          return null
        }

        const isValid = await bcrypt.compare(password, user.password)
        if (!isValid) {
          await logActivity({
            userId: user.id,
            username: user.username,
            action: "LOGIN_FAILED",
            entityType: "Auth",
            description: `Percobaan login gagal untuk "${user.username}" (password salah).`,
          })
          return null
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
