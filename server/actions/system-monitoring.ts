"use server"

import { auth } from "@/auth"
import { logActivity } from "@/lib/activity-log"
import { runMalwareScan, type ScanResult } from "@/lib/malware-scan"

export async function runMalwareScanAction(): Promise<{ error: string } | { result: ScanResult }> {
  const session = await auth()
  if (session?.user.role !== "SUPER_ADMIN") {
    return { error: "Hanya Super Admin yang dapat menjalankan scan." }
  }

  const result = await runMalwareScan()
  const critical = result.findings.filter((f) => f.severity === "critical").length
  const warning = result.findings.length - critical

  await logActivity({
    userId: Number(session.user.id),
    username: session.user.username,
    action: "SECURITY_SCAN",
    entityType: "System",
    description: `${session.user.username} menjalankan scan file upload: ${result.scannedFiles} file diperiksa, ${critical} kritis, ${warning} peringatan.`,
  })

  return { result }
}
