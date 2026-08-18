"use client"

import { useEffect, useState } from "react"
import Image from "next/image"

import { cn } from "@/lib/utils"

const WALLPAPERS = [
  { key: "pagi", src: "/Wallpaper-Pagi.png" },
  { key: "sore", src: "/Wallpaper-Sore.png" },
  { key: "malam", src: "/Wallpaper-Malam.png" },
] as const

type WallpaperKey = (typeof WALLPAPERS)[number]["key"]

// Batas jam SAMA dengan lib/greeting.ts (Pagi 05-11, Siang 11-15, Sore
// 15-18, Malam 18-05) — cuma Siang digabung ke Pagi karena cuma ada 3
// wallpaper (Pagi/Sore/Malam), tidak ada aset terpisah buat Siang.
function keyForHour(hour: number): WallpaperKey {
  if (hour >= 5 && hour < 15) return "pagi"
  if (hour >= 15 && hour < 18) return "sore"
  return "malam"
}

// Ganti wallpaper otomatis sesuai jam LOKAL PERANGKAT (bukan server — sama
// prinsipnya dengan components/live-clock.tsx) dengan transisi crossfade
// halus. Ketiga gambar SEKALIGUS dirender bertumpuk (cuma 3 file, murah),
// yang aktif opacity-100, sisanya opacity-0 — browser otomatis
// meng-animasikan perpindahan opacity-nya, tidak perlu logic fade manual.
//
// Default awal "pagi" DISENGAJA sama persis di server & client (bukan
// dihitung dari jam beneran saat SSR) supaya tidak ada hydration mismatch
// — begitu mount di browser, useEffect langsung koreksi ke wallpaper yang
// benar (crossfade halus kalau ternyata beda, nyaris tidak terlihat kalau
// kebetulan sama).
export function TimeOfDayWallpaper() {
  const [activeKey, setActiveKey] = useState<WallpaperKey>("pagi")

  useEffect(() => {
    function update() {
      setActiveKey(keyForHour(new Date().getHours()))
    }
    update()
    // Cek tiap menit — cukup buat nangkep pas jam lewat batas, tidak perlu
    // granularitas detik untuk sesuatu yang cuma berubah 3x sehari.
    const interval = setInterval(update, 60_000)
    return () => clearInterval(interval)
  }, [])

  return (
    <>
      {WALLPAPERS.map((wallpaper) => (
        <Image
          key={wallpaper.key}
          src={wallpaper.src}
          alt=""
          fill
          priority={wallpaper.key === "pagi"}
          sizes="(min-width: 1024px) 50vw, 100vw"
          className={cn(
            "object-cover transition-opacity duration-1000 ease-in-out",
            activeKey === wallpaper.key ? "opacity-100" : "opacity-0"
          )}
        />
      ))}
    </>
  )
}
