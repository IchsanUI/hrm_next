import Image from "next/image";

import { LoginForm } from "@/components/login-form";
import { LoginTagline } from "@/components/login-tagline";
import { TimeOfDayWallpaper } from "@/components/time-of-day-wallpaper";
import { APP_VERSION } from "@/lib/app-version";

// Split-screen minimalis — panel foto (kiri di desktop, banner pendek di
// atas pada mobile) + panel form. Di desktop foto ditaruh sebagai kartu
// rounded yang "mengambang" dengan jarak dari tepi layar (bukan full-bleed
// nempel ujung) — kesannya lebih modern, dan TimeOfDayWallpaper di
// dalamnya otomatis slide bergantian antar foto.
//
// SENGAJA pakai token tema (`bg-background`/`text-foreground`, BUKAN
// `bg-white` literal) — supaya ikut dark mode seperti halaman lain.
// Sebelumnya dipaksa terang lewat FORCE_LIGHT_THEME, tapi itu cuma
// nge-override custom property di elemen ini, sedangkan elemen turunan
// yang warnanya ikut inherit polos (mis. <h1>/<Label> tanpa kelas warna
// eksplisit) tetap mewarisi `color` computed dari <body> (yang tetap ikut
// dark mode) — hasilnya teks nyaris tak kebaca di atas background putih
// yang dipaksa. Solusinya: jangan dipaksa terang sama sekali, biarkan
// seluruh halaman ini konsisten ikut tema aktif.
export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col bg-background lg:flex-row lg:p-4">
      <div className="relative h-48 w-full shrink-0 overflow-hidden sm:h-64 lg:h-auto lg:w-1/2 lg:rounded-3xl">
        <TimeOfDayWallpaper />
        {/* Sebelumnya ada scrim gelap nutupin SELURUH foto biar teks putih
            kebaca — dihapus atas permintaan (fotonya jadi kelihatan
            terlalu gelap). Diganti gradasi tipis yang cuma naik SEPEREMPAT
            tinggi panel dari bawah (transparan di atasnya) — cukup buat
            aksen & bantu keterbacaan teks tanpa menggelapkan foto secara
            keseluruhan lagi. */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            backgroundImage: "linear-gradient(180deg, transparent 0%, transparent 75%, rgba(0,0,0,0.65) 100%)",
          }}
        />
        {/* Gradasi tipis TAMBAHAN di pojok kiri-atas — cuma buat bantu
            kontras logo (lihat blok di bawah), bukan gradasi utama di atas
            yang buat teks tagline di bawah. Radial biar cuma nge-gelapin
            area pojoknya saja, tidak "narik" gelap ke tengah foto. */}
        <div
          aria-hidden
          className="absolute inset-0 hidden lg:block"
          style={{
            backgroundImage: "radial-gradient(ellipse 560px 360px at top left, rgba(0,0,0,0.7) 0%, transparent 75%)",
          }}
        />

        {/* Wordmark logo BERWARNA — ditaruh pojok KIRI-ATAS foto (bukan lagi
            sejajar teks deskripsi di bawah), mirip posisi wordmark pada
            referensi desain. Tanpa chip background — drop-shadow di logo &
            text-shadow di teks saja yang menjaga keterbacaan di atas foto.
            HANYA desktop (lg+) — di mobile logo ini dipindah ke atas
            heading "Masuk" di panel form (lihat bawah), bukan di sini. */}
        <div className="absolute top-8 left-8 hidden items-center gap-2 lg:flex">
          <Image
            src="/LogoSystem.png"
            alt="Logo"
            width={32}
            height={32}
            className="shrink-0"
            style={{ filter: "drop-shadow(0 1px 6px rgba(0,0,0,0.45))" }}
          />
          <div className="text-left leading-tight">
            <p
              className="text-base font-bold text-white"
              style={{ textShadow: "0 1px 8px rgba(0,0,0,0.55)" }}
            >
              HRIS
            </p>
            <p
              className="text-[11px] text-white/90"
              style={{ textShadow: "0 1px 6px rgba(0,0,0,0.55)" }}
            >
              Human Resource Information System
            </p>
          </div>
        </div>

        <div className="relative flex h-full flex-col items-center justify-center gap-3 p-8 text-center lg:items-start lg:justify-end lg:pb-12 lg:text-left">
          {/* Panel blur — HANYA di mobile/tablet (banner foto pendek di
              atas form, lihat komentar di atas komponen ini). Foto di sini
              gonta-ganti tiap beberapa detik (TimeOfDayWallpaper), jadi
              kontrasnya ke teks putih tidak selalu cukup di SEMUA foto
              (mis. foto "pagi" yang terang) — gradasi tipis di bawah saja
              tidak cukup untuk area tengah banner yang pendek ini. Di
              desktop TIDAK dipakai (lg:bg-transparent dst) karena teksnya
              sudah duduk di pojok bawah yang sudah cukup gelap dari
              gradasi & areanya jauh lebih tinggi. */}
          {/* Tagline berganti-ganti — HANYA desktop. Di mobile banner foto
              cuma pendek (h-48/h-64), tidak cukup tempat buat teks sebesar
              ini tanpa ganggu keterbacaan/rapi. */}
          <div className="hidden flex-col items-start gap-3 lg:flex">
            <LoginTagline />
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-sm">
          {/* Wordmark logo — HANYA mobile/tablet (lg:hidden), duplikat dari
              versi yang nempel di pojok foto pada desktop (lihat atas).
              Ditaruh persis di atas heading "Masuk", BUKAN di pojok. */}
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <Image src="/LogoSystem.png" alt="Logo" width={44} height={44} className="shrink-0" />
            <div className="text-left leading-tight">
              <p className="text-xl font-bold text-foreground">HRIS</p>
              <p className="text-sm text-muted-foreground">Human Resource Information System</p>
            </div>
          </div>

          <LoginForm />
          <p className="mt-6 text-center text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} HRIS. Seluruh hak cipta dilindungi.
            <span className="mx-1.5">&middot;</span>v{APP_VERSION}
          </p>
        </div>
      </div>
    </main>
  );
}
