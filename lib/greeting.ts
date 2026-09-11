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

// Kalimat penutup notifikasi "Absen Berhasil" (lihat lib/attendance/sync.ts)
// — dipilih acak sesuai jam TAP-nya, bukan jam saat notifikasi dikirim,
// supaya nada kalimatnya cocok dengan momen pegawai menempelkan jarinya.
//
// PENTING saat menambah variasi: JANGAN menyinggung soal tepat waktu,
// terlambat, atau lembur berkepanjangan. Pesan yang sama dikirim ke SEMUA
// orang yang absen di jam itu — termasuk yang baru saja datang terlambat
// atau sedang kelelahan — jadi candaan soal jam datang/pulang yang di
// tempat lain terdengar ringan bisa terasa menyindir di sini. Aman: doa
// baik, pengingat istirahat/makan, dan apresiasi.
const ATTENDANCE_CLOSING_POOLS: { maxHour: number; lines: string[] }[] = [
  // Dini hari (00:00–04:59)
  {
    maxHour: 5,
    lines: [
      "Terima kasih. Istirahat yang cukup ya, tubuh juga butuh jeda.",
      "Terima kasih atas usahanya. Semoga bisa segera istirahat.",
      "Terima kasih. Hati-hati di jalan, dan jaga kesehatan.",
    ],
  },
  // Pagi (05:00–10:59)
  {
    maxHour: 11,
    lines: [
      "Terima kasih, semoga harimu cerah dan menyenangkan.",
      "Semangat pagi! Semoga semua urusan hari ini dimudahkan.",
      "Terima kasih. Jangan lupa sarapan biar fokusnya awet.",
      "Selamat bekerja! Semoga hari ini seringan kopi paginya.",
    ],
  },
  // Siang (11:00–14:59)
  {
    maxHour: 15,
    lines: [
      "Terima kasih. Jangan lupa makan siang ya.",
      "Terima kasih. Rehat sebentar boleh kok, biar segar lagi.",
      "Terima kasih, semoga siang ini tetap semangat.",
    ],
  },
  // Sore (15:00–17:59)
  {
    maxHour: 18,
    lines: [
      "Terima kasih, selamat istirahat yaa.",
      "Terima kasih untuk hari ini. Hati-hati di jalan.",
      "Terima kasih. Urusan kantor tinggal di kantor dulu ya.",
      "Terima kasih, semoga perjalanan pulangnya lancar.",
    ],
  },
  // Malam (18:00–23:59)
  {
    maxHour: 24,
    lines: [
      "Terima kasih untuk hari ini. Selamat beristirahat.",
      "Terima kasih. Hati-hati di jalan, sampai jumpa besok.",
      "Terima kasih atas usahanya hari ini. Waktunya recharge.",
      "Terima kasih. Besok hari baru, malam ini istirahat dulu.",
    ],
  },
]

export function getAttendanceClosing(at: Date = new Date()): string {
  const hour = at.getHours()
  const pool =
    ATTENDANCE_CLOSING_POOLS.find((p) => hour < p.maxHour) ??
    ATTENDANCE_CLOSING_POOLS[ATTENDANCE_CLOSING_POOLS.length - 1]
  return pool.lines[Math.floor(Math.random() * pool.lines.length)]
}

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
