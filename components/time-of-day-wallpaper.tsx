"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

import { cn } from "@/lib/utils";

const WALLPAPERS = [
  { key: "pagi", src: "/Wallpaper-Pagi.png" },
  { key: "sore", src: "/Wallpaper-Sore.png" },
  { key: "malam", src: "/Wallpaper-Malam.png" },
] as const;

// Berapa lama tiap foto tampil sebelum pindah ke foto berikutnya.
const SLIDE_INTERVAL_MS = 9_000;
// Lama crossfade. Harus JAUH lebih kecil dari SLIDE_INTERVAL_MS — kalau
// mendekati, fotonya nyaris tidak pernah diam, cuma memudar terus-menerus.
const FADE_MS = 7_600;

// Slideshow yang otomatis muter bergantian ke-3 foto. Ketiganya dirender
// bertumpuk sekaligus (cuma 3 file, murah).
//
// Crossfade-nya SENGAJA cuma memudarkan foto yang MASUK, sementara foto
// sebelumnya dibiarkan tetap penuh di bawahnya sampai tertutup. Kalau
// keduanya diubah bersamaan (yang lama memudar keluar sambil yang baru
// memudar masuk), di tengah transisi dua-duanya setengah transparan
// sehingga latar gelap panel menembus — terlihat seperti kedipan gelap
// sekilas, justru bikin pergantiannya terasa kasar.
//
// Urutan tumpukan diatur lewat z-index dan dikurung di dalam wadah
// `isolate` supaya angka z-nya tidak bocor keluar dan menimpa gradasi,
// logo, atau teks yang dirender sesudah komponen ini di halaman login.
export function TimeOfDayWallpaper() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [previousIndex, setPreviousIndex] = useState<number | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveIndex((prev) => {
        setPreviousIndex(prev);
        return (prev + 1) % WALLPAPERS.length;
      });
    }, SLIDE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      <div className="absolute inset-0 isolate">
        {WALLPAPERS.map((wallpaper, index) => {
          const isActive = index === activeIndex;
          const isPrevious = index === previousIndex;
          return (
            <Image
              key={wallpaper.key}
              src={wallpaper.src}
              alt=""
              fill
              priority={index === 0}
              sizes="(min-width: 1024px) 50vw, 100vw"
              style={{ transitionDuration: `${FADE_MS}ms` }}
              className={cn(
                "object-cover transition-opacity ease-in-out",
                isActive
                  ? "z-20 opacity-100"
                  : isPrevious
                    ? // Tetap penuh sebagai alas supaya tidak ada celah tembus
                      // pandang selama foto baru memudar masuk di atasnya.
                      "z-10 opacity-100"
                    : "z-0 opacity-0",
              )}
            />
          );
        })}
      </div>

      <div className="absolute inset-x-0 bottom-4 flex justify-center gap-1.5 sm:bottom-6">
        {WALLPAPERS.map((wallpaper, index) => (
          <span
            key={wallpaper.key}
            aria-hidden
            className={cn(
              "h-1.5 rounded-full bg-white transition-all duration-700 ease-in-out",
              index === activeIndex ? "w-5 opacity-90" : "w-1.5 opacity-45",
            )}
          />
        ))}
      </div>
    </>
  );
}
