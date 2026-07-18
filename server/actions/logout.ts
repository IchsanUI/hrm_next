"use server"

import { auth, signOut } from "@/auth"
import { logActivity } from "@/lib/activity-log"

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
