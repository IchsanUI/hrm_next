import type { NextAuthConfig } from "next-auth"

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
      }
      return token
    },
    session({ session, token }) {
      session.user.id = token.sub as string
      session.user.role = token.role as typeof session.user.role
      session.user.employeeId = token.employeeId as number | null
      session.user.username = token.username as string
      return session
    },
  },
} satisfies NextAuthConfig
