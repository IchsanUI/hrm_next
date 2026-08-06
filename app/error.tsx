"use client"

import { useEffect } from "react"
import { ServerCrash } from "lucide-react"

import { ErrorPageShell } from "@/components/error-page-shell"

// Error boundary Next.js — nangkep error yang lempar di dalam route segment
// mana pun di bawah root layout (WAJIB Client Component). Error di root
// layout sendiri (jarang) ditangani terpisah oleh app/global-error.tsx.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <ErrorPageShell
      icon={ServerCrash}
      code="Terjadi Kesalahan"
      title="Ada yang Tidak Beres"
      description="Sistem mengalami kendala saat memuat halaman ini. Coba muat ulang kalau masih terjadi, hubungi Admin/IT."
      primaryAction={{ label: "Kembali ke Beranda", href: "/" }}
      secondaryAction={{ label: "Coba Lagi", onClick: reset }}
    />
  )
}
