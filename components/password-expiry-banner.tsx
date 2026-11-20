import Link from "next/link"
import { KeyRound } from "lucide-react"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { computePasswordStatus, getPasswordPolicy } from "@/lib/password-policy"

// Pengingat password mendekati kedaluwarsa (PRD 4.2 / F-04) — bar tipis di
// bawah topbar, hanya saat status WARNING. Setelah lewat tenggat, proxy.ts
// yang mengambil alih (blokir → /ganti-password).
export async function PasswordExpiryBanner({ basePath }: { basePath: "/admin" | "/pegawai" }) {
  const session = await auth()
  if (!session?.user) return null

  const [user, policy] = await Promise.all([
    prisma.user.findUnique({
      where: { id: Number(session.user.id) },
      select: { passwordChangedAt: true, mustChangePassword: true },
    }),
    getPasswordPolicy(),
  ])
  if (!user) return null
  const status = computePasswordStatus(user, policy)
  if (status.state !== "WARNING" || !status.dueAt) return null

  const dueLabel = status.dueAt.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })

  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 sm:px-4 md:px-6 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200 print:hidden"
    >
      <KeyRound className="size-4 shrink-0" />
      <span>
        Password Anda akan kedaluwarsa dalam <strong>{status.daysLeft} hari</strong> ({dueLabel}). Setelah itu Anda wajib
        menggantinya sebelum bisa memakai HRIS.
      </span>
      <Link href={`${basePath}/pengaturan`} className="font-semibold underline underline-offset-2">
        Ganti sekarang
      </Link>
    </div>
  )
}
