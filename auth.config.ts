import type { NextAuthConfig } from "next-auth"

import { prisma } from "@/lib/prisma"
import { parseMenuAccess, type HrMenuKey } from "@/lib/hr-menu-access"

export default {
  pages: {
    signIn: "/login",
  },
  providers: [],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        // Login baru — data dari authorize() di auth.ts.
        token.role = user.role
        token.employeeId = user.employeeId
        token.username = user.username
        token.menuAccess = user.menuAccess
        token.twoFactorEnabled = user.twoFactorEnabled
        return token
      }
      // Request BERIKUTNYA (bukan login) — refresh role/menuAccess dari DB
      // tiap kali, bukan cuma dipakai ulang dari snapshot saat login. Tanpa
      // ini, akun yang baru diberi/dicabut akses HR Admin (lihat Manajemen
      // Akses HR) baru kelihatan perubahannya setelah logout-login manual,
      // karena strategi session JWT normalnya cuma nyimpen snapshot sekali.
      // Aman dipakai di sini (termasuk dari proxy.ts) karena Next.js 16
      // defaultnya proxy jalan di runtime Node.js, bukan Edge — Prisma boleh
      // diimpor langsung.
      if (token.sub) {
        const dbUser = await prisma.user.findUnique({
          where: { id: Number(token.sub) },
          include: { role: true },
        })
        if (dbUser && dbUser.isActive) {
          token.role = dbUser.role.name
          token.employeeId = dbUser.employeeId
          token.username = dbUser.username
          token.menuAccess = parseMenuAccess(dbUser.menuAccess)
          token.twoFactorEnabled = dbUser.role.name === "SUPER_ADMIN" ? !!dbUser.totpEnabledAt : true
        }
      }
      return token
    },
    session({ session, token }) {
      session.user.id = token.sub as string
      session.user.role = token.role as typeof session.user.role
      session.user.employeeId = token.employeeId as number | null
      session.user.username = token.username as string
      session.user.menuAccess = (token.menuAccess as HrMenuKey[] | undefined) ?? []
      session.user.twoFactorEnabled = token.twoFactorEnabled as boolean
      return session
    },
  },
} satisfies NextAuthConfig
