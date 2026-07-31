"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Download, X } from "lucide-react";

const STORAGE_KEY = "pwa-install-banner-dismissed";

// Bar informasi di atas dashboard pegawai — ngajak install PWA & mengarahkan
// ke panduan lengkap per platform di Pengaturan Akun (lihat
// components/pwa-install-guide.tsx, id="pwa-install"). Otomatis tidak
// tampil kalau aplikasi sudah terpasang (display-mode: standalone) atau
// sudah pernah ditutup manual (disimpan di localStorage, sama pola dengan
// LocationPermissionPrompt).
export function PwaInstallBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(display-mode: standalone)").matches) return;
    if (localStorage.getItem(STORAGE_KEY)) return;
    setVisible(true);
  }, []);

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, "1");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="flex shrink-0 items-center gap-3 bg-yellow-500 px-4 py-2.5 text-sm text-dark print:hidden sm:px-6">
      <Download className="size-4 shrink-0 text-dark/80" />
      <p className="min-w-0 flex-1 truncate">
        Pasang HRIS di perangkat Anda menjadi Aplikasi -{" "}
        <Link
          href="/pegawai/pengaturan#pwa-install"
          className="font-semibold underline underline-offset-4 hover:text-white/80"
        >
          Install Sekarang
        </Link>
      </p>
      <button
        type="button"
        onClick={dismiss}
        className="shrink-0 text-dark/70 hover:text-dark"
        aria-label="Tutup"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
