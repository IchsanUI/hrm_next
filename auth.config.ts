import type { NextAuthConfig } from "next-auth"

import type { HrMenuKey } from "@/lib/hr-menu-access"

export default {
  pages: {
    signIn: "/login",
  },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.role = user.role
        token.employeeId = user.employeeId
        token.username = user.username
        token.menuAccess = user.menuAccess
      }
      return token
    },
    session({ session, token }) {
      session.user.id = token.sub as string
      session.user.role = token.role as typeof session.user.role
      session.user.employeeId = token.employeeId as number | null
      session.user.username = token.username as string
      session.user.menuAccess = (token.menuAccess as HrMenuKey[] | undefined) ?? []
      return session
    },
  },
} satisfies NextAuthConfig
