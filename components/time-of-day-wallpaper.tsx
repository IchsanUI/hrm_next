"use client"

import { useEffect, useState } from "react"
import Image from "next/image"

import { cn } from "@/lib/utils"

const WALLPAPERS = [
  { key: "pagi", src: "/Wallpaper-Pagi.png" },
  { key: "sore", src: "/Wallpaper-Sore.png" },
  { key: "malam", src: "/Wallpaper-Malam.png" },
] as const

// Berapa lama tiap foto tampil sebelum pindah ke foto berikutnya.
const SLIDE_INTERVAL_MS = 5_000

// Slideshow yang otomatis muter bergantian ke-3 foto (bukan lagi dipilih
// berdasarkan jam device seperti sebelumnya) — ketiganya dirender
// bertumpuk sekaligus (cuma 3 file, murah), yang aktif opacity-100,
// sisanya opacity-0, jadi transisi crossfade-nya otomatis dari CSS
// transition, bukan logic fade manual. Titik indikator di bawah menandai
// foto mana yang lagi aktif, mirip carousel pada umumnya.
export function TimeOfDayWallpaper() {
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % WALLPAPERS.length)
    }, SLIDE_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [])

  return (
    <>
      {WALLPAPERS.map((wallpaper, index) => (
        <Image
          key={wallpaper.key}
          src={wallpaper.src}
          alt=""
          fill
          priority={index === 0}
          sizes="(min-width: 1024px) 50vw, 100vw"
          className={cn(
            "object-cover transition-opacity duration-1000 ease-in-out",
            index === activeIndex ? "opacity-100" : "opacity-0"
          )}
        />
      ))}

      <div className="absolute inset-x-0 bottom-4 flex justify-center gap-1.5 sm:bottom-6">
        {WALLPAPERS.map((wallpaper, index) => (
          <span
            key={wallpaper.key}
            aria-hidden
            className={cn(
              "h-1.5 rounded-full bg-white transition-all duration-500",
              index === activeIndex ? "w-5 opacity-90" : "w-1.5 opacity-45"
            )}
          />
        ))}
      </div>
    </>
  )
}
