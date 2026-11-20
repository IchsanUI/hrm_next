import { RoleName } from "@prisma/client"
import { DefaultSession } from "next-auth"

import type { HrMenuKey } from "@/lib/hr-menu-access"
import type { PasswordAction } from "@/lib/password-policy"

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
      // Password awal/reset (MUST_CHANGE) atau kedaluwarsa (EXPIRED) — proxy.ts
      // memblokir akses lain & mengarahkan ke /ganti-password. Direfresh dari
      // DB tiap request (lihat auth.config.ts).
      passwordAction: PasswordAction | null
    } & DefaultSession["user"]
  }

  interface User {
    id: string
    username: string
    role: RoleName
    employeeId: number | null
    menuAccess: HrMenuKey[]
    twoFactorEnabled: boolean
    passwordAction: PasswordAction | null
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: RoleName
    employeeId: number | null
    username: string
    menuAccess: HrMenuKey[]
    twoFactorEnabled: boolean
    passwordAction: PasswordAction | null
    // Waktu login sesi ini (ms). BUKAN `iat` — Auth.js memperbarui iat tiap
    // token di-encode ulang, jadi tidak bisa dipakai menilai "sesi dibuat
    // sebelum password diganti/direset".
    loginAt?: number
  }
}
