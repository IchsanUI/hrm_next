"use client"

import { useEffect, useState } from "react"

const ROTATING_WORDS = ["Kepegawaian", "Absensi", "Izin", "Payroll"] as const

// Berapa lama tiap kata tampil sebelum berganti ke kata berikutnya.
const ROTATE_INTERVAL_MS = 2_200

// Tagline di panel foto login — satu kata di tengah kalimat berganti
// otomatis ("Kelola Kepegawaian ... " -> "Kelola Absensi ... " dst), biar
// kelihatan platform ini mencakup banyak modul tanpa kalimatnya jadi
// panjang. Kata yang berganti dibuat sedikit lebih besar & tebal dari teks
// sekitarnya supaya jadi fokus perhatian, bukan cuma teks datar biasa.
export function LoginTagline() {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % ROTATING_WORDS.length)
    }, ROTATE_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [])

  return (
    <p
      className="text-xl font-medium text-white sm:text-3xl"
      style={{ textShadow: "0 1px 6px rgba(0,0,0,0.55)" }}
    >
      Kelola{" "}
      <span
        key={ROTATING_WORDS[index]}
        className="inline-block animate-in fade-in slide-in-from-bottom-2 text-2xl font-bold duration-500 sm:text-4xl"
      >
        {ROTATING_WORDS[index]}
      </span>{" "}
      dalam satu platform.
    </p>
  )
}
