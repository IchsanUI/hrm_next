import { APP_VERSION } from "@/lib/app-version"

export function SidebarVersion() {
  return (
    <div className="mt-auto border-t border-white/10 px-3 py-3">
      <p className="text-sm font-semibold text-white">HRM</p>
      <p className="text-xs text-white/50">v{APP_VERSION}</p>
    </div>
  )
}
