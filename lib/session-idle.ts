// Batas idle sesi — dipakai bersama oleh auth.ts (server) & SessionIdleGuard
// (client). Ubah durasi di SATU tempat ini saja.
//
// Mekanisme:
// - Client (components/session-idle-guard.tsx) memantau aktivitas pengguna
//   (mouse, keyboard, sentuh, scroll) di SEMUA tab. Setelah
//   SESSION_IDLE_MINUTES tanpa aktivitas, client memanggil idleLogoutAction
//   → tercatat di Log Aktivitas ("Logout Otomatis") lalu diarahkan ke login.
// - Server (maxAge JWT) diberi kelonggaran SESSION_SERVER_GRACE_MINUTES di
//   atas batas idle, supaya saat client melakukan logout otomatis sesinya
//   MASIH valid dan pelakunya bisa dicatat. maxAge tetap jadi pengaman
//   terakhir kalau tab ditutup / perangkat tidur (tanpa catatan log).
export const SESSION_IDLE_MINUTES = 15
export const SESSION_WARNING_SECONDS = 60
export const SESSION_SERVER_GRACE_MINUTES = 2
