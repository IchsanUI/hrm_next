import Image from "next/image";

import { LoginForm } from "@/components/login-form";
import { APP_VERSION } from "@/lib/app-version";

const BACKGROUND_PHOTO_URL = "/WallpaperLoginA.png";

// Halaman login sengaja dikunci ke tema terang, apapun preferensi dark mode
// pengguna — supaya kartunya selalu putih solid & kontras di atas background
// navy, bukan ikut jadi navy juga (yang bikin nyaris tak kelihatan).
const FORCE_LIGHT_THEME: React.CSSProperties = {
  colorScheme: "light",
  ["--background" as string]: "oklch(100% 0.00011 271.152)",
  ["--foreground" as string]: "oklch(0.145 0 0)",
  ["--card" as string]: "oklch(1 0 0)",
  ["--card-foreground" as string]: "oklch(0.145 0 0)",
  ["--popover" as string]: "oklch(1 0 0)",
  ["--popover-foreground" as string]: "oklch(0.145 0 0)",
  ["--primary" as string]: "oklch(28.2% 0.091 267.935)",
  ["--primary-foreground" as string]: "oklch(0.985 0 0)",
  ["--secondary" as string]: "oklch(0.97 0 0)",
  ["--secondary-foreground" as string]: "oklch(0.205 0 0)",
  ["--muted" as string]: "oklch(0.97 0 0)",
  ["--muted-foreground" as string]: "oklch(0.556 0 0)",
  ["--accent" as string]: "oklch(0.97 0 0)",
  ["--accent-foreground" as string]: "oklch(0.205 0 0)",
  ["--destructive" as string]: "oklch(0.577 0.245 27.325)",
  ["--border" as string]: "oklch(0.922 0 0)",
  ["--input" as string]: "oklch(0.922 0 0)",
  ["--ring" as string]: "oklch(0.708 0 0)",
};

export default function LoginPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-blue-950 p-4">
      {/* Background dekoratif — dikumpulkan dalam satu layer z-0 +
          pointer-events-none, supaya tidak pernah menutupi atau menangkap
          klik yang seharusnya jatuh ke form login di atasnya. Foto tampil
          hampir penuh (bukan low-opacity lagi) — cuma vignette tipis di
          tepi/bawah biar teks copyright tetap terbaca, plus kartu login-nya
          dikasih backdrop-blur supaya tetap kontras di atas foto apa pun. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 z-0">
        <Image
          src={BACKGROUND_PHOTO_URL}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(180deg, rgba(9,15,45,0.55) 0%, rgba(9,15,45,0.15) 30%, rgba(9,15,45,0.15) 70%, rgba(9,15,45,0.65) 100%)",
          }}
        />
      </div>

      <div className="relative z-10 w-full max-w-md" style={FORCE_LIGHT_THEME}>
        <LoginForm />
      </div>

      <p className="absolute inset-x-0 bottom-6 z-10 text-center text-xs text-white/50">
        &copy; {new Date().getFullYear()} HRIS. Seluruh hak cipta dilindungi.
        <span className="mx-1.5">&middot;</span>v{APP_VERSION}
      </p>
    </main>
  );
}
