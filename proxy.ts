import NextAuth from "next-auth"
import authConfig from "@/auth.config"
import { menuKeyForPath } from "@/lib/hr-menu-access"

const { auth } = NextAuth(authConfig)

export default auth((req) => {
  const { nextUrl } = req
  const isLoggedIn = !!req.auth
  const role = req.auth?.user?.role
  const employeeId = req.auth?.user?.employeeId

  const isLoginPage = nextUrl.pathname === "/login"
  const isAdminRoute = nextUrl.pathname.startsWith("/admin")
  const isEmployeeRoute = nextUrl.pathname.startsWith("/pegawai")
  const isTwoFactorSetupPage = nextUrl.pathname === "/admin/keamanan/2fa/setup"

  if (!isLoggedIn) {
    if (isAdminRoute || isEmployeeRoute) {
      return Response.redirect(new URL("/login", nextUrl))
    }
    return
  }

  const isAdminRole = role === "SUPER_ADMIN" || role === "HR_ADMIN"
  const homeForRole = isAdminRole ? "/admin/dashboard" : "/pegawai/dashboard"

  if (isLoginPage) {
    return Response.redirect(new URL(homeForRole, nextUrl))
  }
  // SUPER_ADMIN yang belum menyelesaikan setup 2FA dipaksa ke wizard di
  // route /admin/** & /pegawai/** manapun (kecuali wizard-nya sendiri) —
  // login dengan password SUDAH berhasil (sesi terbentuk), tapi akses ke
  // fitur lain diblokir sampai enrollment selesai.
  // SENGAJA dibatasi ke isAdminRoute/isEmployeeRoute (BUKAN semua path
  // termasuk "/") — signIn({redirectTo:"/"}) di loginAction menyerahkan
  // redirect awal ke app/page.tsx (pakai redirect() ala Next.js, ikut alur
  // resolusi Server Action). Kalau middleware ikut me-redirect path "/"
  // secara mentah di tengah alur itu juga, response Server Action-nya rusak
  // ("An unexpected response was received from the server" di client) —
  // insiden nyata pernah kejadian. Membiarkan "/" apa adanya di sini, lalu
  // menjaganya di /admin & /pegawai (tujuan akhir redirect app/page.tsx),
  // menghindari itu karena permintaan berikutnya sudah navigasi biasa,
  // bukan bagian dari respons Server Action.
  const needsTwoFactorSetup = role === "SUPER_ADMIN" && req.auth?.user?.twoFactorEnabled === false
  if (needsTwoFactorSetup && (isAdminRoute || isEmployeeRoute) && !isTwoFactorSetupPage) {
    return Response.redirect(new URL("/admin/keamanan/2fa/setup", nextUrl))
  }
  if (isAdminRoute && !isAdminRole) {
    return Response.redirect(new URL(homeForRole, nextUrl))
  }
  // HR_ADMIN (bukan SUPER_ADMIN) cuma boleh masuk grup menu yang sudah
  // dibuka lewat Manajemen Akses HR (lihat lib/hr-menu-access.ts). Menu di
  // luar peta itu (Dashboard, Profil Saya, Ajukan Izin, Riwayat Izin,
  // Approval Center, Peraturan, dan menu khusus SUPER_ADMIN yang memang
  // sengaja dijaga lewat cek role di atas, bukan lewat peta ini) tidak
  // pernah diblokir di sini.
  if (isAdminRoute && role === "HR_ADMIN") {
    const requiredKey = menuKeyForPath(nextUrl.pathname)
    const menuAccess = req.auth?.user?.menuAccess ?? []
    if (requiredKey && !menuAccess.includes(requiredKey)) {
      return Response.redirect(new URL(homeForRole, nextUrl))
    }
  }
  // /pegawai/** = fitur self-service pegawai (profil, ajukan izin, dst).
  // Aksesnya berdasarkan "punya data pegawai" (employeeId), bukan role —
  // supaya HR_ADMIN (yang tetap pegawai sungguhan) tidak kehilangan menu
  // self-service miliknya sendiri setelah diberi akses admin.
  if (isEmployeeRoute && !employeeId) {
    return Response.redirect(new URL(homeForRole, nextUrl))
  }
})

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}
