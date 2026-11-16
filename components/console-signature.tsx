"use client"

import { useEffect } from "react"

import { APP_VERSION } from "@/lib/app-version"

// Tanda tangan pembuat di console browser (F12) — hanya terlihat oleh orang
// teknis yang memeriksa aplikasi. Dicetak sekali per muat halaman.
let printed = false

export function ConsoleSignature() {
  useEffect(() => {
    if (printed) return
    printed = true
    console.log(
      `%cHRIS v${APP_VERSION}%c Perumda BPR Bank Gresik\n%cDirancang & dikembangkan oleh Mochammad Ichsan — EDP/IT Bank Gresik`,
      "background:#172554;color:#fff;font-weight:700;padding:4px 8px;border-radius:4px 0 0 4px",
      "background:#1e40af;color:#fff;padding:4px 8px;border-radius:0 4px 4px 0",
      "color:#64748b;padding-top:6px"
    )
  }, [])
  return null
}
