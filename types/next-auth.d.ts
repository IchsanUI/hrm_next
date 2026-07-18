import { RoleName } from "@prisma/client"
import { DefaultSession } from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      username: string
      role: RoleName
      employeeId: number | null
    } & DefaultSession["user"]
  }

  interface User {
    id: string
    username: string
    role: RoleName
    employeeId: number | null
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: RoleName
    employeeId: number | null
    username: string
  }
}
