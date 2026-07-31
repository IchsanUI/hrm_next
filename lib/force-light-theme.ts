import type { CSSProperties } from "react"

// Dipakai buat kartu/permukaan yang SENGAJA selalu putih terang apa pun
// preferensi dark mode pengguna (mis. kartu login, kartu halaman
// error/404) — override token warna Tailwind/shadcn lewat CSS custom
// property di elemen ini, supaya SEMUA turunannya (termasuk komponen
// seperti Button yang pakai kelas `text-foreground`/`bg-background`/dst)
// ikut konsisten terang, bukan cuma teks yang kita atur manual satu-satu.
// Tanpa ini, token warna itu ikut membalik ke versi dark mode walau kartu
// pembungkusnya tetap putih solid — hasilnya teks nyaris tak terbaca.
export const FORCE_LIGHT_THEME: CSSProperties = {
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
