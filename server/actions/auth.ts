"use server"

import { AuthError, CredentialsSignin } from "next-auth"

import { signIn } from "@/auth"
import { verifyTurnstileToken } from "@/lib/turnstile"

export type LoginResult = { error: string } | undefined

// Error khusus dari authorize() (lib/auth/login-security.ts) punya pesan
// spesifik (akun terkunci, IP diblokir/cooldown) yang aman ditampilkan apa
// adanya — beda dari kegagalan credentials biasa yang sengaja digeneralisir
// jadi "Username atau password salah" supaya tidak membocorkan username mana
// yang valid.
export async function loginAction(
  _prevState: LoginResult,
  formData: FormData
): Promise<LoginResult> {
  const username = String(formData.get("username") ?? "")
  const password = String(formData.get("password") ?? "")

  if (!username || !password) {
    return { error: "Username dan password wajib diisi" }
  }

  const turnstileToken = String(formData.get("cf-turnstile-response") ?? "")
  const isHuman = await verifyTurnstileToken(turnstileToken)
  if (!isHuman) {
    return { error: "Verifikasi keamanan gagal. Silakan coba lagi." }
  }

  try {
    await signIn("credentials", {
      username,
      password,
      redirectTo: "/",
    })
  } catch (error) {
    if (error instanceof CredentialsSignin && error.code !== "credentials") {
      // AuthError menempel ". Read more at https://errors.authjs.dev#..." ke
      // message di constructor-nya — buang itu, sisanya pesan asli kita.
      const [ourMessage] = error.message.split(". Read more at ")
      return { error: ourMessage || "Login ditolak." }
    }
    if (error instanceof AuthError) {
      return { error: "Username atau password salah" }
    }
    throw error
  }
}
