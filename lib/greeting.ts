// Sapaan hangat di header dashboard — dipilih acak per waktu render dari
// beberapa variasi sesuai jam (server-side, jadi aman dari mismatch
// hydration karena tidak pernah dijalankan ulang di browser).
const GREETING_POOLS: { maxHour: number; templates: string[] }[] = [
  // Dini hari (00:00–04:59)
  {
    maxHour: 5,
    templates: ["Selamat Malam, {name}", "Istirahat Dulu, {name}", "Semangat, {name}"],
  },
  // Pagi (05:00–10:59)
  {
    maxHour: 11,
    templates: ["Semangat Pagi, {name}", "Selamat Pagi, {name}", "Pagi yang Cerah, {name}"],
  },
  // Siang (11:00–14:59)
  {
    maxHour: 15,
    templates: ["Selamat Siang, {name}", "Semangat Siang, {name}", "Halo, {name}"],
  },
  // Sore (15:00–17:59)
  {
    maxHour: 18,
    templates: ["Selamat Sore, {name}", "Semangat Sore, {name}", "Halo, {name}"],
  },
  // Malam (18:00–23:59)
  {
    maxHour: 24,
    templates: ["Selamat Malam, {name}", "Semangat Malam, {name}", "Jangan Lupa Istirahat, {name}"],
  },
]

export function getGreeting(name: string, now: Date = new Date()): string {
  const hour = now.getHours()
  const pool = GREETING_POOLS.find((p) => hour < p.maxHour) ?? GREETING_POOLS[GREETING_POOLS.length - 1]
  const template = pool.templates[Math.floor(Math.random() * pool.templates.length)]
  return template.replace("{name}", name)
}
