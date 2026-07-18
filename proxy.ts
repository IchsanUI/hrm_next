import NextAuth from "next-auth"
import authConfig from "@/auth.config"

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
