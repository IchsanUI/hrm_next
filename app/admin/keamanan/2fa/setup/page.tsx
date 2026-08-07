import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { Breadcrumb } from "@/components/breadcrumb"
import { TwoFactorSetupWizard } from "@/components/two-factor-setup-wizard"

// Route WAJIB untuk SUPER_ADMIN yang belum menyelesaikan enrollment 2FA —
// proxy.ts memaksa redirect ke sini dari route manapun sampai selesai.
// Kalau diakses langsung oleh role lain / akun yang 2FA-nya sudah aktif,
// tidak ada gunanya di sini — lempar balik.
export default async function TwoFactorSetupPage() {
  const session = await auth()
  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    redirect("/admin/dashboard")
  }
  if (session.user.twoFactorEnabled) {
    redirect("/admin/pengaturan")
  }

  return (
    <div className="mx-auto grid max-w-lg gap-6">
      <div>
        <Breadcrumb items={[{ label: "Aktivasi 2FA" }]} />
        <h1 className="mb-1 text-2xl font-semibold">Aktifkan Autentikasi Dua Faktor</h1>
        <p className="text-sm text-muted-foreground">
          Akun Super Admin wajib memakai autentikasi dua faktor (2FA). Selesaikan langkah di bawah
          ini sebelum melanjutkan ke bagian lain sistem.
        </p>
      </div>
      <TwoFactorSetupWizard username={session.user.username} />
    </div>
  )
}
