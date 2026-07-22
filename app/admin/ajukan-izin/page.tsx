import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { getIzinTypeSettings } from "@/lib/izin-type-settings"
import { AjukanIzinContent } from "@/components/ajukan-izin-content"

export default async function AdminAjukanIzinPage() {
  const session = await auth()
  if (!session?.user.employeeId) {
    redirect("/admin/dashboard")
  }

  const settings = await getIzinTypeSettings()
  const inactiveLeaveTypes = settings.filter((s) => !s.isActive).map((s) => s.leaveType)

  return <AjukanIzinContent inactiveLeaveTypes={inactiveLeaveTypes} />
}
