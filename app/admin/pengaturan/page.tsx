import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { Breadcrumb } from "@/components/breadcrumb"
import { AccountSettingsForm } from "@/components/account-settings-form"
import { TwoFactorSettingsCard } from "@/components/two-factor-settings-card"
import { PushNotificationToggle } from "@/components/push-notification-toggle"
import { PwaInstallGuide } from "@/components/pwa-install-guide"

export default async function AdminPengaturanPage() {
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
        <Breadcrumb
          items={[
            { label: "Dashboard", href: "/admin/dashboard" },
            { label: "Pengaturan Akun" },
          ]}
        />
        <h1 className="mb-1 text-2xl font-semibold">Pengaturan Akun</h1>
        <p className="text-sm text-muted-foreground">
          Atur foto profil, username, dan password akun Anda.
        </p>
      </div>
      <AccountSettingsForm
        currentUsername={session?.user.username ?? ""}
        currentAvatarUrl={user?.avatarUrl ?? null}
        extraCards={[
          session?.user.role === "SUPER_ADMIN" ? (
            <TwoFactorSettingsCard key="2fa" enabled={!!session.user.twoFactorEnabled} />
          ) : null,
          <PushNotificationToggle key="push" initiallySubscribed={pushSubscriptionCount > 0} />,
        ]}
      />
      <PwaInstallGuide />
    </div>
  )
}
