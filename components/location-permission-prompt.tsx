"use client"

import { useEffect, useState } from "react"
import { MapPin, X } from "lucide-react"

import { Button } from "@/components/ui/button"

const STORAGE_KEY = "location-permission-prompted"

// Popup non-blocking (bukan modal/dialog — tidak menghalangi aktivitas lain)
// yang muncul sekali setelah login, minta izin lokasi lebih awal supaya
// form izin yang butuh lokasi (Lembur, Absen Luar Kantor, Terlambat, dst —
// lihat navigator.geolocation.getCurrentPosition di form-form itu) tidak
// diam-diam gagal karena browser belum pernah diizinkan. Keputusan user
// (aktifkan/nanti saja) disimpan di localStorage supaya popup ini TIDAK
// muncul lagi tiap kali login — status izin sungguhan tetap diingat browser
// sendiri (localStorage di sini cuma menandai "sudah pernah ditanya",
// bukan menyimpan status izinnya).
export function LocationPermissionPrompt() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined" || !navigator.geolocation) return
    if (localStorage.getItem(STORAGE_KEY)) return

    let cancelled = false

    async function check() {
      if (navigator.permissions?.query) {
        try {
          const status = await navigator.permissions.query({
            name: "geolocation" as PermissionName,
          })
          if (status.state === "granted" || status.state === "denied") {
            // Sudah ada keputusan (lewat prompt native browser sebelumnya,
            // bukan lewat popup ini) — tidak perlu tanya lagi, browser yang
            // ingat statusnya sendiri.
            localStorage.setItem(STORAGE_KEY, "1")
            return
          }
        } catch {
          // Permissions API buat geolocation tidak didukung semua browser
          // (mis. Safari lama) — lanjut tampilkan popup, fallback aman.
        }
      }
      if (!cancelled) setVisible(true)
    }

    void check()
    return () => {
      cancelled = true
    }
  }, [])

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, "1")
    setVisible(false)
  }

  function activate() {
    // Klik ini yang benar-benar memicu dialog izin NATIVE browser — begitu
    // dijawab (izinkan/tolak), browser sendiri yang mengingat status itu
    // untuk semua pemanggilan getCurrentPosition berikutnya di form lain.
    navigator.geolocation.getCurrentPosition(
      () => dismiss(),
      () => dismiss(),
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-4 left-4 z-50 w-[320px] rounded-xl border bg-card p-4 shadow-lg sm:left-auto sm:right-4">
      <button
        type="button"
        onClick={dismiss}
        className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"
        aria-label="Tutup"
      >
        <X className="size-4" />
      </button>
      <div className="flex gap-3 pr-4">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400">
          <MapPin className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold">Aktifkan Lokasi</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Izinkan akses lokasi supaya form izin (Lembur, Absen Luar Kantor, dst) bisa otomatis
            mendeteksi lokasi Anda tanpa diminta ulang tiap kali.
          </p>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <Button size="sm" className="flex-1" onClick={activate}>
          Aktifkan Lokasi
        </Button>
        <Button size="sm" variant="outline" className="flex-1" onClick={dismiss}>
          Nanti saja
        </Button>
      </div>
    </div>
  )
}
