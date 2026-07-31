// Service worker HRIS — tiga tugas utama: (1) bikin app bisa di-install
// (PWA installability butuh service worker terdaftar), (2) terima &
// tampilkan Web Push notification (lihat lib/web-push.ts di server, dan
// components/push-notification-toggle.tsx di client), dan (3) tampilkan
// halaman statis offline.html kalau navigasi gagal karena tidak ada
// internet. TETAP BUKAN app offline-first — cuma SATU file statis
// (offline.html) yang di-cache, bukan halaman/data HRIS mana pun, jadi data
// yang dilihat pengguna saat online selalu fresh dari server seperti biasa.

const OFFLINE_CACHE = "hris-offline-v1"
const OFFLINE_URL = "/offline.html"

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(OFFLINE_CACHE).then((cache) => cache.add(OFFLINE_URL))
  )
  // Langsung aktif tanpa nunggu tab lama ditutup.
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    // Buang cache offline versi lama kalau OFFLINE_CACHE pernah ganti nama
    // (bump versi) — supaya tidak menumpuk file basi tak terpakai.
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== OFFLINE_CACHE).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  )
})

// Request navigasi (buka halaman) SELALU dicoba lewat network dulu — kalau
// gagal (offline sungguhan, bukan error 404/500 dari server yang tetap
// terjangkau), fallback ke halaman statis offline.html yang sudah di-cache
// saat install. Request lain (API, aset, dst) dibiarkan lewat apa adanya,
// tidak disentuh — data HRIS tetap selalu diambil fresh dari network.
self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return
  event.respondWith(
    fetch(event.request).catch(() => caches.match(OFFLINE_URL))
  )
})

// Terima push dari server (web-push), tampilkan sebagai notifikasi native
// OS/browser. Payload dikirim sebagai JSON string (lihat PushPayload di
// lib/web-push.ts): { title, body, link }.
self.addEventListener("push", (event) => {
  if (!event.data) return

  let payload
  try {
    payload = event.data.json()
  } catch {
    payload = { title: "HRIS", body: event.data.text() }
  }

  const title = payload.title || "HRIS"
  const options = {
    body: payload.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data: { link: payload.link || "/" },
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

// Klik notifikasi — fokus tab yang sudah terbuka kalau ada (dan arahkan ke
// link tujuan), atau buka tab baru kalau belum ada tab HRIS yang terbuka.
self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const targetUrl = event.notification.data?.link || "/"

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          client.navigate(targetUrl)
          return client.focus()
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl)
      }
    })
  )
})
