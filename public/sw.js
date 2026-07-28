// Service worker HRIS — dua tugas utama: (1) bikin app bisa di-install
// (PWA installability butuh service worker terdaftar, walau tidak dipakai
// buat caching agresif — data HRIS harus selalu fresh, BUKAN app offline-first),
// dan (2) terima & tampilkan Web Push notification (lihat lib/web-push.ts
// di server, dan components/push-notification-toggle.tsx di client).

self.addEventListener("install", (event) => {
  // Langsung aktif tanpa nunggu tab lama ditutup — service worker ini tidak
  // caching apa pun yang bisa bikin versi lama "nyangkut".
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim())
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
