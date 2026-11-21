"use client";

import { useEffect, useState } from "react";


// Berapa lama tiap kata tampil sebelum berganti ke kata berikutnya.
const ROTATE_INTERVAL_MS = 2_200;

// Tagline di panel foto login — satu kata di tengah kalimat berganti
// otomatis ("Kelola Kepegawaian ... " -> "Kelola Absensi ... " dst), biar
// kelihatan platform ini mencakup banyak modul tanpa kalimatnya jadi
// panjang. Kata yang berganti dibuat sedikit lebih besar & tebal dari teks
// sekitarnya supaya jadi fokus perhatian, bukan cuma teks datar biasa.
// Kata-katanya diatur Super Admin di menu Tampilan Login.
export function LoginTagline({ words }: { words: string[] }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % words.length);
    }, ROTATE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [words.length]);
  const word = words[index % words.length] ?? "";

  return (
    <p
      className="text-xl font-medium text-white sm:text-3xl"
      style={{ textShadow: "0 1px 6px rgba(0,0,0,0.55)" }}
    >
      Kelola{" "}
      <span
        key={`${index}-${word}`}
        className="inline-block animate-in fade-in slide-in-from-bottom-2 text-2xl font-bold duration-500 sm:text-4xl"
      >
        {word}
      </span>{" "}
      dalam satu platform.
    </p>
  );
}
