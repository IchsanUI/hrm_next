"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

import { cn } from "@/lib/utils";
import {
  focusToPosition,
  isUploadedWallpaper,
  type LoginAppearance,
} from "@/lib/login-appearance-shared";

// Slideshow gambar panel login. Daftar gambar, titik fokus potongan, dan
// durasinya diatur Super Admin di menu Tampilan Login (lib/login-appearance.ts).
//
// Semua gambar dirender bertumpuk sekaligus. Crossfade-nya SENGAJA cuma
// memudarkan foto yang MASUK, sementara foto sebelumnya dibiarkan tetap
// penuh di bawahnya sampai tertutup. Kalau keduanya diubah bersamaan (yang
// lama memudar keluar sambil yang baru memudar masuk), di tengah transisi
// dua-duanya setengah transparan sehingga latar gelap panel menembus —
// terlihat seperti kedipan gelap sekilas.
//
// Urutan tumpukan diatur lewat z-index dan dikurung di dalam wadah
// `isolate` supaya angka z-nya tidak bocor keluar dan menimpa gradasi,
// logo, atau teks yang dirender sesudah komponen ini di halaman login.
export function TimeOfDayWallpaper({
  wallpapers,
  slideSeconds,
}: {
  wallpapers: LoginAppearance["wallpapers"];
  slideSeconds: number;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [previousIndex, setPreviousIndex] = useState<number | null>(null);
  const slideMs = slideSeconds * 1000;
  // Lama crossfade harus jauh lebih kecil dari durasi tampil — kalau
  // mendekati, fotonya nyaris tidak pernah diam, cuma memudar terus.
  const fadeMs = Math.min(7_600, Math.round(slideMs * 0.6));

  useEffect(() => {
    if (wallpapers.length < 2) return;
    const interval = setInterval(() => {
      setActiveIndex((prev) => {
        setPreviousIndex(prev);
        return (prev + 1) % wallpapers.length;
      });
    }, slideMs);
    return () => clearInterval(interval);
  }, [wallpapers.length, slideMs]);

  return (
    <>
      <div className="absolute inset-0 isolate">
        {wallpapers.map((wallpaper, index) => {
          const isActive = index === activeIndex;
          const isPrevious = index === previousIndex;
          return (
            <Image
              key={wallpaper.id}
              src={wallpaper.imageUrl}
              alt=""
              fill
              priority={index === 0}
              // Unggahan sudah dikecilkan & WebP saat disimpan; lewati
              // optimizer karena filenya disajikan route /uploads (runtime).
              unoptimized={isUploadedWallpaper(wallpaper.imageUrl)}
              sizes="(min-width: 1024px) 50vw, 100vw"
              style={{
                transitionDuration: `${fadeMs}ms`,
                objectPosition: focusToPosition(wallpaper.focusX, wallpaper.focusY),
              }}
              className={cn(
                "object-cover transition-opacity ease-in-out",
                isActive
                  ? "z-20 opacity-100"
                  : isPrevious
                    ? "z-10 opacity-100"
                    : "z-0 opacity-0",
              )}
            />
          );
        })}
      </div>

      <div
        className={cn(
          "absolute inset-x-0 bottom-4 flex justify-center gap-1.5 sm:bottom-6",
          wallpapers.length < 2 && "hidden",
        )}
      >
        {wallpapers.map((wallpaper, index) => (
          <span
            key={wallpaper.id}
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
