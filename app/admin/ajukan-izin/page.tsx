import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { AjukanIzinContent } from "@/components/ajukan-izin-content"

export default async function AdminAjukanIzinPage() {
  const session = await auth()
  if (!session?.user.employeeId) {
    redirect("/admin/dashboard")
  }

  return <AjukanIzinContent />
}
