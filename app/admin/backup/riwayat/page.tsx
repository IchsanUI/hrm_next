import { redirect } from "next/navigation"

// Digabung ke Backup Database → tab Riwayat. Dipertahankan untuk link lama.
export default async function RiwayatBackupRedirect({
  searchParams,
}: {
  searchParams: Promise<{ dari?: string; sampai?: string }>
}) {
  const { dari, sampai } = await searchParams
  const query = dari && sampai ? `?dari=${encodeURIComponent(dari)}&sampai=${encodeURIComponent(sampai)}` : ""
  redirect(`/admin/backup/database/riwayat${query}`)
}
