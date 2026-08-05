import { revalidatePath } from "next/cache"
import { NextResponse } from "next/server"

import { runOvertimeAutoReject } from "@/lib/overtime-auto-reject"

// Endpoint buat dipanggil CRON EKSTERNAL (Task Scheduler Windows, cron
// Linux, layanan cron pihak ketiga, dst — bukan dijadwalkan dari dalam app
// ini). Jalankan tiap 5–15 menit sekali; idempotent kalau dipanggil lebih
// sering/lebih jarang.
//
// Setup:
//   1. Set environment variable CRON_SECRET (string acak panjang, mis. hasil
//      `openssl rand -hex 32`) di server tempat app ini di-deploy.
//   2. Jadwalkan pemanggil (curl/PowerShell/dst) ke URL endpoint ini dengan
//      header:
//        Authorization: Bearer <CRON_SECRET>
//      Contoh curl:
//        curl -H "Authorization: Bearer <CRON_SECRET>" \
//          https://hris.contoh.com/api/cron/reject-expired-overtime
//      Contoh Windows Task Scheduler (PowerShell):
//        Invoke-RestMethod -Uri "https://hris.contoh.com/api/cron/reject-expired-overtime" `
//          -Headers @{ Authorization = "Bearer <CRON_SECRET>" }
//
// Endpoint MENOLAK request (500) kalau CRON_SECRET belum diset di server —
// fail-closed, bukan diam-diam jalan tanpa autentikasi.
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return NextResponse.json(
      { error: "CRON_SECRET belum dikonfigurasi di server. Endpoint ini dinonaktifkan." },
      { status: 500 }
    )
  }

  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const result = await runOvertimeAutoReject()

  if (result.rejectedCount > 0) {
    for (const prefix of ["/admin", "/pegawai"]) {
      revalidatePath(`${prefix}/riwayat-izin`)
      revalidatePath(`${prefix}/approval-center`)
    }
  }

  return NextResponse.json(result)
}
