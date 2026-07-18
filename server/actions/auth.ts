"use server"

import { AuthError } from "next-auth"

import { signIn } from "@/auth"

export type LoginResult = { error: string } | undefined

export async function loginAction(
  _prevState: LoginResult,
  formData: FormData
): Promise<LoginResult> {
  const username = String(formData.get("username") ?? "")
  const password = String(formData.get("password") ?? "")

  if (!username || !password) {
    return { error: "Username dan password wajib diisi" }
  }

  try {
    await signIn("credentials", {
      username,
      password,
      redirectTo: "/",
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Username atau password salah" }
    }
    throw error
  }
}
