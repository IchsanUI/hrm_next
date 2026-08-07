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
      // Cuma relevan kalau role === SUPER_ADMIN (role lain selalu true —
      // lihat auth.ts/auth.config.ts). false = belum menyelesaikan setup
      // 2FA, dipaksa redirect ke wizard oleh proxy.ts. Direfresh dari DB
      // tiap request (bukan snapshot login), jadi status berubah efektif
      // seketika tanpa perlu re-login.
      twoFactorEnabled: boolean
    } & DefaultSession["user"]
  }

  interface User {
    id: string
    username: string
    role: RoleName
    employeeId: number | null
    menuAccess: HrMenuKey[]
    twoFactorEnabled: boolean
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: RoleName
    employeeId: number | null
    username: string
    menuAccess: HrMenuKey[]
    twoFactorEnabled: boolean
  }
}
