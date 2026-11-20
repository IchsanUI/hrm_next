// Logout otomatis karena tidak aktif — konstanta yang AMAN dipakai di client.
// Nilai yang berlaku diatur SUPER_ADMIN (Kebijakan Keamanan → SessionPolicy,
// dibaca lewat lib/session-policy.ts); angka di sini hanya nilai bawaan &
// batas yang diizinkan.
//
// Mekanisme:
// - Client (components/session-idle-guard.tsx) memantau aktivitas pengguna
//   (mouse, keyboard, sentuh, scroll) di SEMUA tab. Setelah idleMinutes
//   tanpa aktivitas, client memanggil idleLogoutAction → tercatat di Log
//   Aktivitas ("Logout Otomatis") lalu diarahkan ke login.
// - Server (callback jwt, auth.config.ts) menolak sesi yang tidak menerima
//   request selama idleMinutes + SESSION_SERVER_GRACE_MINUTES — pengaman
//   kalau tab ditutup / perangkat tidur (tanpa catatan log). Kelonggaran
//   ini supaya saat client melakukan logout otomatis sesinya MASIH valid
//   dan pelakunya bisa dicatat.
export const SESSION_IDLE_DEFAULT_MINUTES = 15
export const SESSION_WARNING_DEFAULT_SECONDS = 60
export const SESSION_IDLE_MIN_MINUTES = 5
export const SESSION_IDLE_MAX_MINUTES = 120
export const SESSION_WARNING_MIN_SECONDS = 30
export const SESSION_WARNING_MAX_SECONDS = 300
export const SESSION_SERVER_GRACE_MINUTES = 2
