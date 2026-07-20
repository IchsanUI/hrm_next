import { RoleName } from "@prisma/client"
import { DefaultSession } from "next-auth"

import type { HrMenuKey } from "@/lib/hr-menu-access"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      username: string
      role: RoleName
      employeeId: number | null
      // Cuma relevan kalau role === HR_ADMIN — lihat lib/hr-menu-access.ts.
      // Diisi sekali saat login, jadi perubahan akses baru berlaku efektif
      // setelah re-login (sama seperti perubahan role selama ini).
      menuAccess: HrMenuKey[]
    } & DefaultSession["user"]
  }

  interface User {
    id: string
    username: string
    role: RoleName
    employeeId: number | null
    menuAccess: HrMenuKey[]
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: RoleName
    employeeId: number | null
    username: string
    menuAccess: HrMenuKey[]
  }
}
