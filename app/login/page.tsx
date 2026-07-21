import Image from "next/image"

import { LoginForm } from "@/components/login-form"
import { APP_VERSION } from "@/lib/app-version"

// Foto tim kantor dari Unsplash (free license, tidak wajib atribusi) —
// dipasang low-opacity di belakang jadi cuma "bayangan", bukan fokus utama.
const BACKGROUND_PHOTO_URL =
  "https://images.unsplash.com/photo-1758873268745-dd2cf0d677b5?fm=jpg&q=80&w=2400&auto=format&fit=crop"

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
}

export default function LoginPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-blue-950 p-4">
      {/* Background dekoratif — dikumpulkan dalam satu layer z-0 +
          pointer-events-none, supaya tidak pernah menutupi atau menangkap
          klik yang seharusnya jatuh ke form login di atasnya. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 z-0">
        <Image
          src={BACKGROUND_PHOTO_URL}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover opacity-15"
        />
        <div className="absolute inset-0 bg-blue-950/70" />
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(circle at 15% 20%, rgba(255,255,255,0.10), transparent 40%), radial-gradient(circle at 85% 15%, rgba(255,255,255,0.08), transparent 40%), radial-gradient(circle at 50% 100%, rgba(255,255,255,0.06), transparent 45%)",
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
      </div>

      <div className="relative z-10 w-full max-w-md" style={FORCE_LIGHT_THEME}>
        <LoginForm />
      </div>

      <p className="absolute inset-x-0 bottom-6 z-10 text-center text-xs text-white/50">
        &copy; {new Date().getFullYear()} HRIS. Seluruh hak cipta dilindungi.
        <span className="mx-1.5">&middot;</span>
        v{APP_VERSION}
      </p>
    </main>
  )
}
