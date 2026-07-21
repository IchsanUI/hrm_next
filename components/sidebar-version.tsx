import { APP_VERSION } from "@/lib/app-version"

export function SidebarVersion() {
  return (
    <div className="mt-auto border-t border-white/10 px-3 pt-5 pb-3">
      <p className="text-sm font-semibold text-white">HRIS</p>
      <p className="text-[11px] leading-tight text-white/40">
        Human Resource Information System
      </p>
      <p className="mt-1 text-xs text-white/50">v{APP_VERSION}</p>
    </div>
  )
}
