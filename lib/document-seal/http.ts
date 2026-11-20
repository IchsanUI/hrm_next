import { createHash, createHmac, timingSafeEqual } from "crypto"

import type { SealServiceConfig } from "@/lib/document-seal/config"

// Tanda tangan HMAC dua arah (HRIS → layanan, layanan → HRIS):
//   X-Seal-Client     id klien (hanya arah HRIS → layanan)
//   X-Seal-Timestamp  detik Unix
//   X-Seal-Signature  hex(HMAC-SHA256(secret, `${timestamp}\n${METHOD}\n${path}\n${sha256hex(body)}`))
// `path` = pathname + query dari URL tujuan. Selisih jam > 5 menit ditolak.

export const SEAL_MAX_CLOCK_SKEW_SECONDS = 300

export function sha256Hex(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex")
}

export function computeSealSignature(secret: string, timestamp: string, method: string, path: string, body: string) {
  return createHmac("sha256", secret).update(`${timestamp}\n${method.toUpperCase()}\n${path}\n${sha256Hex(body)}`).digest("hex")
}

export function verifySealSignature(input: {
  secret: string
  timestamp: string | null
  signature: string | null
  method: string
  path: string
  body: string
}): boolean {
  const { secret, timestamp, signature, method, path, body } = input
  if (!timestamp || !signature || !/^\d+$/.test(timestamp) || !/^[0-9a-f]{64}$/i.test(signature)) return false
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > SEAL_MAX_CLOCK_SKEW_SECONDS) return false
  const expected = Buffer.from(computeSealSignature(secret, timestamp, method, path, body), "hex")
  const given = Buffer.from(signature, "hex")
  return expected.length === given.length && timingSafeEqual(expected, given)
}

export class SealServiceError extends Error {
  constructor(
    message: string,
    readonly status: number | null = null
  ) {
    super(message)
    this.name = "SealServiceError"
  }
}

export async function sealServiceFetch<T>(config: SealServiceConfig, method: "GET" | "POST", path: string, payload?: unknown): Promise<T> {
  const url = new URL(config.baseUrl + path)
  const body = payload === undefined ? "" : JSON.stringify(payload)
  const timestamp = String(Math.floor(Date.now() / 1000))
  const signature = computeSealSignature(config.clientSecret, timestamp, method, url.pathname + url.search, body)

  let res: Response
  try {
    res = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-Seal-Client": config.clientId,
        "X-Seal-Timestamp": timestamp,
        "X-Seal-Signature": signature,
      },
      body: method === "GET" ? undefined : body,
      signal: AbortSignal.timeout(config.timeoutMs),
      cache: "no-store",
    })
  } catch (error) {
    throw new SealServiceError(`Layanan segel tidak dapat dihubungi: ${error instanceof Error ? error.message : String(error)}`)
  }

  const text = await res.text()
  let json: unknown = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    // dibiarkan null; ditangani di bawah
  }
  if (!res.ok) {
    const message = (json as { error?: { message?: string } } | null)?.error?.message ?? `HTTP ${res.status}`
    throw new SealServiceError(`Layanan segel menolak permintaan: ${message}`, res.status)
  }
  if (json === null) throw new SealServiceError("Respons layanan segel bukan JSON yang valid.", res.status)
  return json as T
}
