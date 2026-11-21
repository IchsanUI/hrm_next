import Link from "next/link"
import { redirect } from "next/navigation"
import { ImageIcon } from "lucide-react"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { LOGIN_APPEARANCE_FALLBACK, LOGIN_SLIDE_SECONDS } from "@/lib/login-appearance-shared"
import { parseTaglineWords } from "@/lib/login-appearance"
import { Breadcrumb } from "@/components/breadcrumb"
import { LoginAppearanceManager } from "@/components/login-appearance-manager"

// Tampilan Login — khusus SUPER_ADMIN: gambar slideshow, titik fokus
// potongan, durasi, dan kata tagline halaman login (lib/login-appearance.ts).
export default async function TampilanLoginPage() {
  const session = await auth()
  if (session?.user.role !== "SUPER_ADMIN") redirect("/admin/dashboard")

  const [wallpapers, settings] = await Promise.all([
    prisma.loginWallpaper.findMany({ orderBy: [{ sortOrder: "asc" }, { id: "asc" }] }),
    prisma.loginSettings.findUnique({ where: { id: 1 } }),
  ])
  const words = parseTaglineWords(settings?.taglineWords)

  return (
    <div>
      <Breadcrumb items={[{ label: "Dashboard", href: "/admin/dashboard" }, { label: "Tampilan Login" }]} />
      <div className="mb-6 flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <ImageIcon className="size-5" />
        </span>
        <div>
          <h1 className="text-xl font-semibold sm:text-2xl">Tampilan Login</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Atur gambar dan tagline di panel kiri halaman login. Perubahan tampil untuk semua pengguna dalam ±1 menit.{" "}
            <Link href="/login" target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline">
              Lihat halaman login
            </Link>
          </p>
        </div>
      </div>
      <LoginAppearanceManager
        wallpapers={wallpapers.map((w) => ({
          id: w.id,
          imageUrl: w.imageUrl,
          label: w.label,
          focusX: w.focusX,
          focusY: w.focusY,
          isActive: w.isActive,
          sortOrder: w.sortOrder,
        }))}
        slideSeconds={settings?.slideSeconds ?? LOGIN_SLIDE_SECONDS.default}
        taglineWords={words.length ? words : LOGIN_APPEARANCE_FALLBACK.taglineWords}
      />
    </div>
  )
}
