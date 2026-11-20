// Konfigurasi koneksi ke Layanan Segel Dokumen (sistem terpisah yang
// menerbitkan QR TTD digital / stempel). Selama SEAL_SERVICE_URL belum diisi,
// HRIS memakai QR lokal seperti sebelumnya (lihat getDocumentQr).
//
//   SEAL_SERVICE_URL     https://segel.bankgresik.co.id   (tanpa / di akhir)
//   SEAL_CLIENT_ID       hris
//   SEAL_CLIENT_SECRET   rahasia bersama untuk tanda tangan HMAC permintaan
//   SEAL_WEBHOOK_SECRET  rahasia untuk memverifikasi callback (default = CLIENT_SECRET)
//   SEAL_TIMEOUT_MS      batas waktu permintaan, default 8000
//   APP_PUBLIC_URL       alamat publik HRIS untuk callbackUrl, mis. https://hris.bankgresik.co.id

export type SealServiceConfig = {
  baseUrl: string
  clientId: string
  clientSecret: string
  webhookSecret: string
  timeoutMs: number
  callbackUrl: string | null
}

export function getSealServiceConfig(): SealServiceConfig | null {
  const baseUrl = process.env.SEAL_SERVICE_URL?.trim().replace(/\/+$/, "")
  const clientId = process.env.SEAL_CLIENT_ID?.trim()
  const clientSecret = process.env.SEAL_CLIENT_SECRET?.trim()
  if (!baseUrl || !clientId || !clientSecret) return null

  const publicUrl = (process.env.APP_PUBLIC_URL ?? process.env.AUTH_URL)?.trim().replace(/\/+$/, "")
  const timeout = Number(process.env.SEAL_TIMEOUT_MS)
  return {
    baseUrl,
    clientId,
    clientSecret,
    webhookSecret: process.env.SEAL_WEBHOOK_SECRET?.trim() || clientSecret,
    timeoutMs: Number.isFinite(timeout) && timeout > 0 ? timeout : 8000,
    callbackUrl: publicUrl ? `${publicUrl}/api/integrations/segel-dokumen/webhook` : null,
  }
}
