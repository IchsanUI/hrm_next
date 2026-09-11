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

// Berapa user yang push-nya dikirim barengan. Web Push = 1 request HTTP ke
// server push vendor (FCM/Mozilla/dst) PER perangkat — kalau seluruh pegawai
// (bisa ratusan) ditembak sekaligus pakai Promise.all polos, rawan
// rate-limit/timeout & bikin server action-nya menggantung lama.
const PUSH_BATCH_SIZE = 20

// Versi massal createNotification untuk SATU isi notifikasi yang sama ke
// BANYAK user (mis. slip gaji terbit → semua pegawai). Beda dari memanggil
// createNotification berkali-kali: baris DB-nya ditulis sekali lewat
// createMany (1 query, bukan N), dan push-nya dikirim per batch.
export async function createNotificationForUsers(
  userIds: number[],
  params: Omit<CreateNotificationParams, "userId">
) {
  if (userIds.length === 0) return

  try {
    await prisma.notification.createMany({
      data: userIds.map((userId) => ({
        userId,
        title: params.title,
        message: params.message,
        link: params.link,
      })),
    })
  } catch (err) {
    // Best-effort, sama seperti createNotification — aksi utama yang memicu
    // notifikasi ini tidak boleh ikut gagal.
    console.error("Gagal membuat notifikasi massal:", err)
    return
  }

  for (let i = 0; i < userIds.length; i += PUSH_BATCH_SIZE) {
    await Promise.all(
      userIds.slice(i, i + PUSH_BATCH_SIZE).map((userId) =>
        sendPushToUser(userId, {
          title: params.title,
          body: params.message,
          link: params.link,
        })
      )
    )
  }
}
