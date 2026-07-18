import { prisma } from "@/lib/prisma"

type CreateNotificationParams = {
  userId: number
  title: string
  message: string
  link?: string
}

// Best-effort, sama seperti logActivity — gagal kirim notifikasi tidak boleh
// menggagalkan aksi utama (mis. approval tetap tersimpan walau notifikasi gagal).
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
  }
}
