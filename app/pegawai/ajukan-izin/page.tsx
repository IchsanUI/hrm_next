import { getIzinTypeSettings } from "@/lib/izin-type-settings"
import { AjukanIzinContent } from "@/components/ajukan-izin-content"

export default async function AjukanIzinPage() {
  const settings = await getIzinTypeSettings()
  const inactiveLeaveTypes = settings.filter((s) => !s.isActive).map((s) => s.leaveType)

  return <AjukanIzinContent inactiveLeaveTypes={inactiveLeaveTypes} />
}
