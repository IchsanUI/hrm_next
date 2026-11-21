import Image from "next/image"

// Layar loading area konten dashboard — dipakai app/admin/loading.tsx &
// app/pegawai/loading.tsx. Next.js menampilkannya seketika saat pindah
// halaman (sidebar & topbar tetap), lalu menggantinya begitu halaman siap.
// Muncul dengan jeda singkat (animasi fade) supaya tidak berkedip pada
// perpindahan yang cepat.
export function PageLoading({ label = "Memuat halaman…" }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-[60vh] animate-in items-center justify-center fade-in duration-300"
      style={{ animationDelay: "150ms", animationFillMode: "both" }}
    >
      <div className="flex flex-col items-center gap-4 rounded-2xl border bg-card px-10 py-8 shadow-sm">
        <div className="relative flex size-16 items-center justify-center">
          <span className="absolute inset-0 animate-spin rounded-full border-4 border-primary/15 border-t-primary" />
          <Image src="/LogoSystem.png" alt="" width={28} height={28} className="animate-pulse" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium">{label}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Mohon tunggu sebentar</p>
        </div>
      </div>
    </div>
  )
}
