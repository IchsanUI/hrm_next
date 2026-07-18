import { redirect } from "next/navigation"

import { auth } from "@/auth"

export default async function RootPage() {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  const isAdminRole = session.user.role === "SUPER_ADMIN" || session.user.role === "HR_ADMIN"
  redirect(isAdminRole ? "/admin/dashboard" : "/pegawai/dashboard")
}
