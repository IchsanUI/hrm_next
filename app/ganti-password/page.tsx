import Image from "next/image"
import { redirect } from "next/navigation"
import { KeyRound, LogOut } from "lucide-react"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { computePasswordStatus, getPasswordPolicy } from "@/lib/password-policy"
import { logoutAction } from "@/server/actions/logout"
import { PasswordChangeForm } from "@/components/password-change-form"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

// Halaman WAJIB ganti password — proxy.ts mengarahkan ke sini kalau password
// masih password awal/hasil reset admin (MUST_CHANGE) atau sudah kedaluwarsa
// (EXPIRED); semua halaman lain diblokir sampai password diganti. Sengaja di
// luar /admin & /pegawai supaya tidak memuat menu/dashboard sama sekali.
export default async function GantiPasswordPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const [user, policy] = await Promise.all([
    prisma.user.findUnique({
      where: { id: Number(session.user.id) },
      select: { username: true, passwordChangedAt: true, mustChangePassword: true },
    }),
    getPasswordPolicy(),
  ])
  if (!user) redirect("/login")

  const status = computePasswordStatus(user, policy)
  const isInitial = status.state === "MUST_CHANGE"
  const dueLabel = status.dueAt?.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100/70 px-4 py-10 dark:bg-background">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-3">
          <Image src="/LogoSystem.png" alt="Logo" width={40} height={40} />
          <div className="leading-tight">
            <p className="text-lg font-bold">HRIS</p>
            <p className="text-xs text-muted-foreground">Human Resource Information System</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="mb-1 flex size-10 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
              <KeyRound className="size-5" />
            </div>
            <CardTitle>{isInitial ? "Ganti Password Awal Anda" : "Password Anda Telah Kedaluwarsa"}</CardTitle>
            <CardDescription>
              {isInitial
                ? "Akun Anda masih memakai password awal atau password hasil reset admin. Demi keamanan, buat password baru sebelum melanjutkan."
                : `Masa berlaku password Anda berakhir${dueLabel ? ` pada ${dueLabel}` : ""}. Sesuai kebijakan keamanan bank, buat password baru sebelum melanjutkan.`}{" "}
              Setelah berhasil, Anda akan diminta login kembali dengan password baru.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6">
            <PasswordChangeForm submitLabel="Simpan Password Baru" />
            <form action={logoutAction} className="border-t pt-4">
              <p className="mb-2 text-xs text-muted-foreground">
                Masuk sebagai <span className="font-medium text-foreground">{user.username}</span>
              </p>
              <Button type="submit" variant="outline" size="sm">
                <LogOut />
                Keluar
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
