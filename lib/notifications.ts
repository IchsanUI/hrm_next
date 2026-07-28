import { prisma } from "@/lib/prisma"
import { sendPushToUser } from "@/lib/web-push"

type CreateNotificationParams = {
  userId: number
  title: string
  message: string
  link?: string
}

// Best-effort, sama seperti logActivity — gagal kirim notifikasi tidak boleh
// menggagalkan aksi utama (mis. approval tetap tersimpan walau notifikasi
// gagal). Selain disimpan ke DB (ditampilkan di NotificationsMenu), SEKARANG
// juga dikirim sebagai Web Push kalau user ini punya perangkat yang
// subscribe (lihat lib/web-push.ts) — muncul sebagai notifikasi native
// browser/OS walau tab/app-nya tidak sedang dibuka.
export async function createNotification(params: CreateNotificationParams) {
  try {
    await prisma.notification.create({
      data: {
        userId: params.userId,
        title: params.title,
        message: params.message,
        link: params.link,
      },
    })
  } catch (err) {
    console.error("Gagal membuat notifikasi:", err)
    return
  }

  await sendPushToUser(params.userId, {
    title: params.title,
    body: params.message,
    link: params.link,
  })
}
