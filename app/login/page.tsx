import Image from "next/image";

import { LoginForm } from "@/components/login-form";
import { APP_VERSION } from "@/lib/app-version";
import { FORCE_LIGHT_THEME } from "@/lib/force-light-theme";

const BACKGROUND_PHOTO_URL = "/WallpaperLoginA.png";

export default function LoginPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-blue-950 p-4">
      {/* Background dekoratif — dikumpulkan dalam satu layer z-0 +
          pointer-events-none, supaya tidak pernah menutupi atau menangkap
          klik yang seharusnya jatuh ke form login di atasnya. Foto tampil
          hampir penuh (bukan low-opacity lagi) — cuma vignette tipis di
          tepi/bawah biar teks copyright tetap terbaca, plus kartu login-nya
          dikasih backdrop-blur supaya tetap kontras di atas foto apa pun. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
      >
        {/* scale-110 nutupin tepi yang jadi transparan/pudar akibat blur —
            tanpa ini muncul garis putih tipis di pinggir viewport. */}
        <Image
          src={BACKGROUND_PHOTO_URL}
          alt=""
          fill
          priority
          sizes="100vw"
          className="scale-110 object-cover blur-sm"
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
