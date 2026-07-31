import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { AccountSettingsForm } from "@/components/account-settings-form"
import { PushNotificationToggle } from "@/components/push-notification-toggle"
import { PwaInstallGuide } from "@/components/pwa-install-guide"

export default async function PegawaiPengaturanPage() {
  const session = await auth()
  const [user, pushSubscriptionCount] = session?.user.id
    ? await Promise.all([
        prisma.user.findUnique({ where: { id: Number(session.user.id) }, select: { avatarUrl: true } }),
        prisma.pushSubscription.count({ where: { userId: Number(session.user.id) } }),
      ])
    : [null, 0]

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="mb-1 text-2xl font-semibold">Pengaturan Akun</h1>
        <p className="text-sm text-muted-foreground">
          Atur foto profil, username, dan password akun Anda.
        </p>
      </div>
      <AccountSettingsForm
        currentUsername={session?.user.username ?? ""}
        currentAvatarUrl={user?.avatarUrl ?? null}
      />
      <PushNotificationToggle initiallySubscribed={pushSubscriptionCount > 0} />
      <PwaInstallGuide />
    </div>
  )
}
