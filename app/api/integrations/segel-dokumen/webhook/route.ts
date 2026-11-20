import { NextResponse } from "next/server"

import { getSealServiceConfig } from "@/lib/document-seal/config"
import { verifySealSignature } from "@/lib/document-seal/http"
import { applySealWebhook, type SealWebhookPayload } from "@/lib/document-seal"

// Callback dari Layanan Segel Dokumen: segel terbit, ditolak, atau dicabut.
// Tanpa sesi login — keaslian dijamin tanda tangan HMAC (lib/document-seal/http.ts).
export async function POST(request: Request) {
  const config = getSealServiceConfig()
  if (!config) return NextResponse.json({ error: "Integrasi segel belum dikonfigurasi." }, { status: 503 })

  const body = await request.text()
  const url = new URL(request.url)
  const valid = verifySealSignature({
    secret: config.webhookSecret,
    timestamp: request.headers.get("x-seal-timestamp"),
    signature: request.headers.get("x-seal-signature"),
    method: "POST",
    path: url.pathname + url.search,
    body,
  })
  if (!valid) return NextResponse.json({ error: "Tanda tangan tidak valid." }, { status: 401 })

  let payload: SealWebhookPayload
  try {
    payload = JSON.parse(body)
  } catch {
    return NextResponse.json({ error: "Body bukan JSON." }, { status: 400 })
  }
  const events = ["seal.issued", "seal.rejected", "seal.revoked"]
  if (!events.includes(payload?.event) || typeof payload.seal?.clientReference !== "string" || typeof payload.seal?.id !== "string") {
    return NextResponse.json({ error: "Payload tidak dikenal." }, { status: 400 })
  }

  const applied = await applySealWebhook(payload)
  if (!applied) return NextResponse.json({ error: "Segel tidak ditemukan." }, { status: 404 })
  return NextResponse.json({ ok: true })
}
