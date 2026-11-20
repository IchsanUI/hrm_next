"use server"

import { auth, signOut } from "@/auth"
import { logActivity } from "@/lib/activity-log"
import { getSessionPolicy } from "@/lib/session-policy"

export async function logoutAction() {
  const session = await auth()
  if (session?.user) {
    await logActivity({
      userId: Number(session.user.id),
      username: session.user.username,
      action: "LOGOUT",
      entityType: "Auth",
      description: `${session.user.username} logout.`,
    })
  }
  await signOut({ redirectTo: "/login" })
}

// Dipanggil SessionIdleGuard setelah durasi idle (pengaturan Super Admin) tanpa aktivitas.
// Kalau sesi server ternyata sudah habis duluan (mis. perangkat tidur lama),
// tidak ada pelaku yang bisa dicatat — cukup bersihkan cookie & ke login.
export async function idleLogoutAction() {
  const session = await auth()
  if (session?.user) {
    const { idleMinutes } = await getSessionPolicy()
    await logActivity({
      userId: Number(session.user.id),
      username: session.user.username,
      action: "LOGOUT_IDLE",
      entityType: "Auth",
      description: `${session.user.username} otomatis logout karena tidak ada aktivitas selama ${idleMinutes} menit.`,
    })
  }
  await signOut({ redirectTo: "/login?reason=idle" })
}
