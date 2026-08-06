// Sapaan hangat di header dashboard — dipilih acak per waktu render dari
// beberapa variasi sesuai jam (server-side, jadi aman dari mismatch
// hydration karena tidak pernah dijalankan ulang di browser).
const GREETING_POOLS: { maxHour: number; labels: string[] }[] = [
  // Dini hari (00:00–04:59)
  { maxHour: 5, labels: ["Selamat Malam,", "Istirahat Dulu,", "Semangat,"] },
  // Pagi (05:00–10:59)
  { maxHour: 11, labels: ["Semangat Pagi,", "Selamat Pagi,", "Pagi yang Cerah,"] },
  // Siang (11:00–14:59)
  { maxHour: 15, labels: ["Selamat Siang,", "Semangat Siang,", "Halo,"] },
  // Sore (15:00–17:59)
  { maxHour: 18, labels: ["Selamat Sore,", "Semangat Sore,", "Halo,"] },
  // Malam (18:00–23:59)
  { maxHour: 24, labels: ["Selamat Malam,", "Semangat Malam,", "Jangan Lupa Istirahat,"] },
]

export type Greeting = { label: string; name: string }

// Dipecah jadi label+name terpisah (bukan satu string gabungan) supaya
// pemanggil bebas kasih gaya beda ke tiap bagian, mis. label kecil warna
// primary + nama besar bold (lihat app/pegawai/dashboard/page.tsx).
export function getGreeting(name: string, now: Date = new Date()): Greeting {
  const hour = now.getHours()
  const pool = GREETING_POOLS.find((p) => hour < p.maxHour) ?? GREETING_POOLS[GREETING_POOLS.length - 1]
  const label = pool.labels[Math.floor(Math.random() * pool.labels.length)]
  return { label, name }
}
