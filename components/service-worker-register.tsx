"use client"

import { useEffect } from "react"

// Didaftarkan sekali di root layout (lihat app/layout.tsx) — service worker
// ini WAJIB terdaftar supaya app bisa di-install (PWA) dan supaya Web Push
// notification bisa diterima (lihat public/sw.js). Tidak me-render apa pun.
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.error("Gagal mendaftarkan service worker:", err)
    })
  }, [])

  return null
}
