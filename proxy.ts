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
