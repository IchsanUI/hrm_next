import { headers } from "next/headers"

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"

async function getClientIpFromHeaders(): Promise<string | undefined> {
  try {
    const h = await headers()
    const forwardedFor = h.get("x-forwarded-for")
    if (forwardedFor) return forwardedFor.split(",")[0]!.trim()
    return h.get("x-real-ip") ?? undefined
  } catch {
    return undefined
  }
}

// Verifikasi token widget Cloudflare Turnstile (form field "cf-turnstile-response",
// diisi otomatis oleh script Turnstile begitu widget-nya sukses) ke server
// Cloudflare — dipanggil dari loginAction SEBELUM signIn(), jadi bot/script
// otomatis ditolak sebelum sempat menyentuh authorize() sama sekali.
export async function verifyTurnstileToken(token: string | null | undefined): Promise<boolean> {
  if (!token) return false

  const secretKey = process.env.TURNSTILE_SECRET_KEY
  if (!secretKey) {
    // Belum dikonfigurasi (mis. environment dev tanpa .env Turnstile) —
    // jangan sampai HRIS-nya malah gak bisa dipakai sama sekali gara-gara
    // captcha belum di-setup. Log jelas biar ketahuan waktu deploy production.
    console.warn("TURNSTILE_SECRET_KEY belum diset — verifikasi captcha dilewati.")
    return true
  }

  const remoteIp = await getClientIpFromHeaders()

  try {
    const body = new URLSearchParams({ secret: secretKey, response: token })
    if (remoteIp) body.set("remoteip", remoteIp)

    const res = await fetch(VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    })
    const data = (await res.json()) as { success: boolean }
    return data.success === true
  } catch {
    // Cloudflare unreachable — fail closed (tolak login) lebih aman daripada
    // diam-diam melewati captcha kalau layanannya lagi down.
    return false
  }
}
