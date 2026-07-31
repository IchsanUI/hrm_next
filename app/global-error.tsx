"use client"

import { useEffect } from "react"
import { AlertOctagon } from "lucide-react"

import { ErrorPageShell } from "@/components/error-page-shell"
import "./globals.css"

// Dipanggil Next.js kalau error terjadi di ROOT LAYOUT itu sendiri (bukan
// cuma di satu route segment — app/error.tsx yang menangani kasus itu).
// Kasus ini SANGAT jarang, tapi kalau terjadi, root layout ikut gagal
// dirender juga — jadi file ini WAJIB menyediakan <html>/<body> sendiri,
// tidak bisa mengandalkan app/layout.tsx yang justru sedang error.
export default function GlobalError({
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
    <html lang="en">
      <body>
        <ErrorPageShell
          icon={AlertOctagon}
          code="Kesalahan Sistem"
          title="Aplikasi Gagal Dimuat"
          description="Terjadi kesalahan fatal pada sistem. Coba muat ulang halaman — kalau masih terjadi, hubungi Admin/IT."
          secondaryAction={{ label: "Coba Lagi", onClick: reset }}
        />
      </body>
    </html>
  )
}
