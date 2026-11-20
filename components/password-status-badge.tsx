import { Badge } from "@/components/ui/badge"
import type { PasswordStatus } from "@/lib/password-policy"

// Badge status password akun — dipakai Kebijakan Password & Manajemen Pengguna.
export function PasswordStatusBadge({ status }: { status: Pick<PasswordStatus, "state" | "daysLeft"> }) {
  switch (status.state) {
    case "MUST_CHANGE":
      return (
        <Badge variant="outline" className="border-amber-400 text-amber-700 dark:text-amber-300">
          Wajib ganti
        </Badge>
      )
    case "EXPIRED":
      return <Badge variant="destructive">Kedaluwarsa</Badge>
    case "WARNING":
      return (
        <Badge variant="outline" className="border-amber-400 text-amber-700 dark:text-amber-300">
          {status.daysLeft} hari lagi
        </Badge>
      )
    case "ACTIVE":
      return (
        <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300">
          Aktif
        </Badge>
      )
    default:
      return <Badge variant="outline">Belum diberlakukan</Badge>
  }
}
