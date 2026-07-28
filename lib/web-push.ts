import webpush from "web-push"

import { prisma } from "@/lib/prisma"

const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY
const vapidSubject = process.env.VAPID_SUBJECT ?? "mailto:admin@example.com"

// Kalau VAPID key belum diisi di .env (mis. environment dev yang baru
// clone repo), push dilewati diam-diam — bukan fitur wajib buat aplikasi
// jalan (notifikasi in-app di NotificationsMenu tetap berfungsi normal).
const isConfigured = Boolean(vapidPublicKey && vapidPrivateKey)
if (isConfigured) {
  webpush.setVapidDetails(vapidSubject, vapidPublicKey!, vapidPrivateKey!)
}

export type PushPayload = {
  title: string
  body: string
  link?: string
}

// Dipanggil dari lib/notifications.ts SETELAH baris Notification tersimpan
// ke DB — best-effort (gagal kirim push TIDAK BOLEH menggagalkan aksi
// utama), dan dikirim ke SEMUA perangkat/browser milik user ini sekaligus
// (lihat PushSubscription — satu user bisa subscribe dari beberapa
// perangkat). Subscription yang sudah tidak valid (endpoint dihapus
// browser/notifikasi diblokir permanen, web-push balas 404/410) otomatis
// dibersihkan dari tabel supaya tidak dicoba kirim lagi tiap kali.
export async function sendPushToUser(userId: number, payload: PushPayload): Promise<void> {
  if (!isConfigured) return

  const subscriptions = await prisma.pushSubscription.findMany({ where: { userId } })
  if (subscriptions.length === 0) return

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          JSON.stringify(payload)
        )
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode
        if (statusCode === 404 || statusCode === 410) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {})
        } else {
          console.error("Gagal kirim push notification:", err)
        }
      }
    })
  )
}
