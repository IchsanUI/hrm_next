import { LoginForm } from "@/components/login-form";
import { TimeOfDayWallpaper } from "@/components/time-of-day-wallpaper";
import { APP_VERSION } from "@/lib/app-version";
import { FORCE_LIGHT_THEME } from "@/lib/force-light-theme";

// Split-screen minimalis — panel foto (kiri di desktop, banner pendek di
// atas pada mobile) + panel form putih bersih. Sebelumnya foto dipakai
// full-bleed blur di belakang kartu form mengambang; sekarang foto tampil
// TAJAM (tanpa blur) sebagai elemen desain sendiri, bukan lagi "background
// dekoratif" — kesannya lebih modern/korporat & tetap konsisten di mobile
// (foto jadi banner pendek, bukan hilang).
export default function LoginPage() {
  return (
    <main
      className="flex min-h-screen flex-col bg-white lg:flex-row"
      style={FORCE_LIGHT_THEME}
    >
      <div className="relative h-48 w-full shrink-0 overflow-hidden sm:h-64 lg:h-auto lg:w-1/2">
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
        <div className="relative flex h-full flex-col items-center justify-center gap-3 p-8 text-center lg:items-start lg:justify-end lg:pb-12 lg:text-left">
          <span
            aria-label="Logo"
            role="img"
            className="size-11 shrink-0 bg-white lg:size-14"
            style={{
              WebkitMaskImage: "url(/LogoSystemWhite.png)",
              maskImage: "url(/LogoSystemWhite.png)",
              WebkitMaskSize: "contain",
              maskSize: "contain",
              WebkitMaskRepeat: "no-repeat",
              maskRepeat: "no-repeat",
              WebkitMaskPosition: "center",
              maskPosition: "center",
              filter: "drop-shadow(0 1px 6px rgba(0,0,0,0.45))",
            }}
          />
          <div>
            <p
              className="text-lg font-semibold text-white sm:text-xl"
              style={{ textShadow: "0 1px 8px rgba(0,0,0,0.55)" }}
            >
              Sistem HRIS
            </p>
            <p
              className="text-sm text-white/90"
              style={{ textShadow: "0 1px 6px rgba(0,0,0,0.55)" }}
            >
              Kelola kepegawaian, absensi, izin, dan payroll dalam satu platform.
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-sm">
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
