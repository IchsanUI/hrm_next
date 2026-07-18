import { auth } from "@/auth"
import { Breadcrumb } from "@/components/breadcrumb"
import { AccountSettingsForm } from "@/components/account-settings-form"

export default async function AdminPengaturanPage() {
  const session = await auth()

  return (
    <div>
      <Breadcrumb
        items={[
          { label: "Dashboard", href: "/admin/dashboard" },
          { label: "Peraturan" },
        ]}
      />
      <h1 className="mb-1 text-2xl font-semibold">Peraturan</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Atur ulang username dan password akun Anda.
      </p>
      <AccountSettingsForm currentUsername={session?.user.username ?? ""} />
    </div>
  )
}
