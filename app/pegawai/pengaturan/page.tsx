import { auth } from "@/auth"
import { AccountSettingsForm } from "@/components/account-settings-form"

export default async function PegawaiPengaturanPage() {
  const session = await auth()

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold">Peraturan</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Atur ulang username dan password akun Anda.
      </p>
      <AccountSettingsForm currentUsername={session?.user.username ?? ""} />
    </div>
  )
}
