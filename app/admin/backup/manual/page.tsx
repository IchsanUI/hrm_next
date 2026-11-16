import { redirect } from "next/navigation"

// Digabung ke Backup Database (lihat app/admin/backup/database). Dipertahankan
// supaya link/bookmark lama tetap jalan.
export default async function BackupManualRedirect({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string }>
}) {
  const { scope } = await searchParams
  redirect(scope ? `/admin/backup/database?scope=${encodeURIComponent(scope)}` : "/admin/backup/database")
}
