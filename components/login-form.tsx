"use client"

import { useActionState } from "react"
import Script from "next/script"

import { loginAction } from "@/server/actions/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PasswordInput } from "@/components/ui/password-input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(loginAction, undefined)

  return (
    <Card className="w-full max-w-md shadow-xl">
      <CardHeader>
        {/* LogoSystemWhite.png = siluet putih polos di atas transparan —
            "diwarnai" pakai CSS mask (alpha channel logo jadi mask, warna
            aslinya diabaikan) alih-alih bikin file PNG navy terpisah. */}
        <span
          aria-label="Logo"
          role="img"
          className="mx-auto mb-2 size-14 bg-blue-950"
          style={{
            WebkitMaskImage: "url(/LogoSystemWhite.png)",
            maskImage: "url(/LogoSystemWhite.png)",
            WebkitMaskSize: "contain",
            maskSize: "contain",
            WebkitMaskRepeat: "no-repeat",
            maskRepeat: "no-repeat",
            WebkitMaskPosition: "center",
            maskPosition: "center",
          }}
        />
        <CardTitle className="text-center">Masuk ke HRIS</CardTitle>
        <CardDescription className="text-center">
          Gunakan username dan password akun Anda.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              name="username"
              autoComplete="username"
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password">Password</Label>
            <PasswordInput
              id="password"
              name="password"
              autoComplete="current-password"
              required
            />
          </div>
          {/* Widget Cloudflare Turnstile — otomatis bikin hidden input
              "cf-turnstile-response" begitu verifikasi captcha selesai,
              ikut terkirim sebagai bagian FormData karena ada di dalam
              <form>. Diverifikasi ulang di server (loginAction), token dari
              sini tidak pernah dipercaya mentah-mentah.
              data-appearance="always" — kotaknya SENGAJA selalu tampil
              (bukan disembunyikan) supaya pengguna langsung lihat ada
              lapisan keamanan captcha aktif di form login. Bagian dalam
              kotaknya sendiri dirender di iframe milik Cloudflare, tidak
              bisa di-restyle lewat CSS kita. */}
          <div
            className="cf-turnstile"
            data-sitekey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
            data-theme="light"
            data-size="flexible"
            data-appearance="always"
            data-language="id"
          />
          {state?.error ? (
            <p className="text-destructive text-sm">{state.error}</p>
          ) : null}
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? "Memproses..." : "Masuk"}
          </Button>
        </form>
      </CardContent>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer />
    </Card>
  )
}
