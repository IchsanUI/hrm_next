"use server"

import { AuthError, CredentialsSignin } from "next-auth"

import { signIn } from "@/auth"
import { verifyTurnstileToken } from "@/lib/turnstile"

export type LoginResult =
  | { error: string }
  // Password sudah benar (SUPER_ADMIN dengan 2FA aktif) — client harus
  // menampilkan step kedua (input kode TOTP/pemulihan) tanpa mengulang
  // username/password.
  | { requiresTwoFactor: true }
  | undefined

// Error khusus dari authorize() (lib/auth/login-security.ts) punya pesan
// spesifik (akun terkunci, IP diblokir/cooldown, kode 2FA salah) yang aman
// ditampilkan apa adanya — beda dari kegagalan credentials biasa yang
// sengaja digeneralisir jadi "Username atau password salah" supaya tidak
// membocorkan username mana yang valid.
export async function loginAction(
  _prevState: LoginResult,
  formData: FormData
): Promise<LoginResult> {
  const username = String(formData.get("username") ?? "")
  const password = String(formData.get("password") ?? "")
  const totp = String(formData.get("totp") ?? "").trim()
  const recoveryCode = String(formData.get("recoveryCode") ?? "").trim()

  if (!username || !password) {
    return { error: "Username dan password wajib diisi" }
  }

  // Turnstile HANYA diverifikasi di submit pertama (belum ada kode 2FA) —
  // token Cloudflare sekali pakai, tidak bisa diverifikasi ulang di submit
  // kedua (step TOTP memakai form yang sama, tapi widget-nya disembunyikan
  // di client). Submit kedua sudah datang dari orang yang lolos
  // username+password, jadi tidak perlu captcha lagi.
  if (!totp && !recoveryCode) {
    const turnstileToken = String(formData.get("cf-turnstile-response") ?? "")
    const isHuman = await verifyTurnstileToken(turnstileToken)
    if (!isHuman) {
      return { error: "Verifikasi keamanan gagal. Silakan coba lagi." }
    }
  }

  try {
    // JANGAN kirim totp/recoveryCode sebagai `key: undefined` — signIn()
    // meneruskannya lewat URLSearchParams secara internal, yang men-
    // stringify `undefined` jadi literal string "undefined" (bukan benar-
    // benar kosong). Akibatnya authorize() melihat totp = "undefined"
    // (truthy!), lolos dari pengecekan "belum ada kode", lalu gagal
    // verifikasi dan dianggap KODE SALAH walau user belum sempat mengisi
    // apa pun — insiden nyata pernah kejadian. Solusinya: field ini harus
    // benar-benar TIDAK ADA di object kalau kosong, bukan diisi undefined.
    await signIn("credentials", {
      username,
      password,
      ...(totp ? { totp } : {}),
      ...(recoveryCode ? { recoveryCode } : {}),
      redirectTo: "/",
    })
  } catch (error) {
    if (error instanceof CredentialsSignin) {
      if (error.code === "totp_required") {
        return { requiresTwoFactor: true }
      }
      if (error.code !== "credentials") {
        // AuthError menempel ". Read more at https://errors.authjs.dev#..."
        // ke message di constructor-nya — buang itu, sisanya pesan asli kita.
        const [ourMessage] = error.message.split(". Read more at ")
        return { error: ourMessage || "Login ditolak." }
      }
    }
    if (error instanceof AuthError) {
      return { error: "Username atau password salah" }
    }
    throw error
  }
}
