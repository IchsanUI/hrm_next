import Image from "next/image"

import { AboutAppBadge } from "@/components/about-app-badge"

// Identitas aplikasi di atas sidebar (desktop & mobile): logo, singkatan,
// versi, dan kepanjangannya — satu tempat, tidak diulang di bawah.
export function SidebarBrand({ logoSize = 40 }: { logoSize?: number }) {
  return (
    <div className="flex items-center gap-3">
      <Image src="/LogoSystemWhite.png" alt="Logo" width={logoSize} height={logoSize} className="shrink-0" />
      <div className="min-w-0 leading-tight">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-white">HRIS</span>
          <AboutAppBadge />
        </div>
        {/* Dua baris tetap — satu baris tidak muat di samping logo (w-64) dan
            terpotong "Sy…". */}
        <p className="mt-0.5 text-[10px] leading-snug text-white/45">
          Human Resource
          <br />
          Information System
        </p>
      </div>
    </div>
  )
}

// Dua baris tetap (bukan dibiarkan membungkus sendiri) supaya tidak ada satu
// kata yang menggantung di baris terakhir pada sidebar sempit.
export function SidebarCopyright() {
  return (
    <div className="mt-auto border-t border-white/10 px-3 pt-4 pb-2 text-[10px] leading-snug text-white/35">
      <p>Copyright &copy; 2025</p>
      <p className="whitespace-nowrap">EDP/IT Bank Gresik</p>
    </div>
  )
}
