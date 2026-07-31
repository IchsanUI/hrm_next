import { SearchX } from "lucide-react"

import { ErrorPageShell } from "@/components/error-page-shell"

export default function NotFound() {
  return (
    <ErrorPageShell
      icon={SearchX}
      code="404"
      title="Halaman Tidak Ditemukan"
      description="Halaman yang Anda cari tidak ada, sudah dipindahkan, atau URL-nya salah ketik."
      primaryAction={{ label: "Kembali ke Beranda", href: "/" }}
    />
  )
}
