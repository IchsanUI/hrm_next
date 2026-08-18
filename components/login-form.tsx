"use client"

import { useActionState, useEffect, useRef, useState } from "react"
import Script from "next/script"
import { KeyRound } from "lucide-react"

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
import { Dialog, DialogContent } from "@/components/ui/dialog"

type TurnstileRenderOptions = {
  sitekey: string
  theme?: "light" | "dark" | "auto"
  size?: "normal" | "compact" | "flexible"
  appearance?: "always" | "execute" | "interaction-only"
  language?: string
  "error-callback"?: () => void
  "expired-callback"?: () => void
}

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: TurnstileRenderOptions) => string
      remove: (widgetId: string) => void
    }
  }
}

// Berapa lama nunggu window.turnstile muncul sebelum dianggap gagal load
// (mis. diblokir ad-blocker/firewall kantor, atau koneksi lambat) —
// setelah ini tombol "Muat ulang" ditampilkan.
const TURNSTILE_LOAD_TIMEOUT_MS = 10_000

// Render EKSPLISIT (bukan implisit lewat attribute data-sitekey) — sengaja,
// karena render implisit cuma nge-scan DOM SEKALI saat script Cloudflare-nya
// pertama kali load. Kalau <LoginForm> ini di-mount ulang secara client-side
// (mis. navigasi balik ke /login tanpa full page reload) TANPA script-nya
// ikut di-load ulang, div baru itu tidak pernah ke-render — inilah kenapa
// widget-nya kadang "tidak muncul otomatis". Render eksplisit ngecek
// window.turnstile langsung tiap kali komponen ini mount, jadi selalu
// konsisten apa pun histori navigasinya.
function TurnstileWidget() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [loadFailed, setLoadFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    let widgetId: string | null = null
    const deadline = Date.now() + TURNSTILE_LOAD_TIMEOUT_MS

    function tryRender() {
      if (cancelled || !containerRef.current) return
      if (window.turnstile) {
        widgetId = window.turnstile.render(containerRef.current, {
          sitekey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "",
          theme: "light",
          size: "flexible",
          appearance: "always",
          language: "id",
          "error-callback": () => setLoadFailed(true),
          "expired-callback": () => setLoadFailed(true),
        })
        return
      }
      if (Date.now() > deadline) {
        setLoadFailed(true)
        return
      }
      setTimeout(tryRender, 150)
    }
    tryRender()

    return () => {
      cancelled = true
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId)
    }
  }, [])

  return (
    <div>
      {/* Widget Cloudflare Turnstile — otomatis bikin hidden input
          "cf-turnstile-response" begitu verifikasi captcha selesai, ikut
          terkirim sebagai bagian FormData karena container ini ada di
          dalam <form>. Diverifikasi ulang di server (loginAction), token
          dari sini tidak pernah dipercaya mentah-mentah. */}
      <div ref={containerRef} />
      {loadFailed ? (
        <p className="text-xs text-destructive">
          Verifikasi keamanan gagal dimuat (cek koneksi internet/ad-blocker).{" "}
          <button
            type="button"
            className="underline underline-offset-2"
            onClick={() => window.location.reload()}
          >
            Muat ulang halaman
          </button>
        </p>
      ) : null}
    </div>
  )
}

// Berapa kali kode 2FA boleh salah di modal ini sebelum form ditutup dan
// dikembalikan ke login awal (username/password kosong lagi). Ini murni
// UX (biar user tidak "terjebak" di modal), BUKAN pengganti lockout akun
// yang sungguhan — itu tetap ditangani server (MAX_PASSWORD_FAILURES = 5,
// lihat lib/auth/login-security.ts).
const MAX_MODAL_ATTEMPTS = 3

function OtpBoxes({
  value,
  onChange,
  disabled,
}: {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}) {
  const refs = useRef<Array<HTMLInputElement | null>>([])
  const digits = value.padEnd(6, " ").split("").slice(0, 6)

  function setDigit(index: number, char: string) {
    const next = digits.slice()
    next[index] = char || " "
    onChange(next.join("").trimEnd())
  }

  function handleChange(index: number, raw: string) {
    const char = raw.replace(/\D/g, "").slice(-1)
    setDigit(index, char)
    if (char && index < 5) refs.current[index + 1]?.focus()
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[index]?.trim() && index > 0) {
      refs.current[index - 1]?.focus()
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6)
    if (!pasted) return
    e.preventDefault()
    onChange(pasted)
    refs.current[Math.min(pasted.length, 5)]?.focus()
  }

  return (
    <div className="flex justify-center gap-2">
      {digits.map((char, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el
          }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          autoFocus={i === 0}
          disabled={disabled}
          value={char.trim()}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          className="size-11 rounded-md border border-input bg-background text-center text-lg font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      ))}
    </div>
  )
}

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(loginAction, undefined)
  // Controlled — username/password HARUS tetap terisi & ikut terkirim saat
  // modal kode 2FA submit, tanpa user mengetik ulang.
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [twoFactorOpen, setTwoFactorOpen] = useState(false)
  const [attempts, setAttempts] = useState(0)
  const [totp, setTotp] = useState("")
  const [useRecoveryCode, setUseRecoveryCode] = useState(false)
  const [recoveryCode, setRecoveryCode] = useState("")
  const wasPending = useRef(false)

  const step1Error =
    !twoFactorOpen && state && "error" in state ? state.error : undefined
  const modalError = twoFactorOpen && state && "error" in state ? state.error : undefined

  function resetToLogin() {
    setTwoFactorOpen(false)
    setUsername("")
    setPassword("")
    setAttempts(0)
    setTotp("")
    setRecoveryCode("")
    setUseRecoveryCode(false)
  }

  useEffect(() => {
    // Hanya bereaksi SEKALI per transisi pending -> selesai (bukan tiap kali
    // objek state berubah referensi) — mencegah double-count di React
    // Strict Mode / re-render lain yang tidak terkait submit baru.
    if (!wasPending.current || isPending) {
      wasPending.current = isPending
      return
    }
    wasPending.current = isPending

    if (state && "requiresTwoFactor" in state) {
      setTwoFactorOpen(true)
      return
    }
    if (twoFactorOpen && state && "error" in state) {
      const nextAttempts = attempts + 1
      if (nextAttempts >= MAX_MODAL_ATTEMPTS) {
        resetToLogin()
        return
      }
      setAttempts(nextAttempts)
      setTotp("")
      setRecoveryCode("")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPending])

  return (
    <Card className="w-full py-0 shadow-none ring-0">
      <CardHeader className="px-0">
        {/* Logo TIDAK ditaruh di sini lagi (dulu cuma tampil di mobile,
            lg:hidden) — di mobile pun sudah ada logo di banner foto atas
            (app/login/page.tsx), jadi dobel & bikin tampilan tidak rapi. */}
        <CardTitle className="text-2xl font-semibold tracking-tight">Masuk</CardTitle>
        <CardDescription>
          Gunakan username dan password akun Anda untuk melanjutkan.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        <form action={formAction} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              name="username"
              autoComplete="username"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={twoFactorOpen}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password">Password</Label>
            <PasswordInput
              id="password"
              name="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={twoFactorOpen}
            />
          </div>
          <TurnstileWidget />
          {step1Error ? <p className="text-destructive text-sm">{step1Error}</p> : null}
          <Button type="submit" className="w-full" disabled={isPending || twoFactorOpen}>
            {isPending && !twoFactorOpen ? "Memproses..." : "Masuk"}
          </Button>
        </form>
      </CardContent>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="afterInteractive" />

      <Dialog open={twoFactorOpen} onOpenChange={(open) => !open && resetToLogin()}>
        <DialogContent className="max-w-sm text-center">
          <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-blue-950/10 text-blue-950">
            <KeyRound className="size-7" />
          </div>
          <div className="grid gap-1">
            <h2 className="text-lg font-semibold">Masukkan Kode OTP</h2>
            <p className="text-sm text-muted-foreground">
              {useRecoveryCode
                ? "Masukkan salah satu kode pemulihan yang Anda simpan saat aktivasi 2FA."
                : "Buka aplikasi authenticator Anda dan masukkan 6 digit kode yang tampil."}
            </p>
          </div>

          <form action={formAction} className="grid gap-4">
            {/* Hidden — username/password sudah divalidasi di step 1, ikut
                terkirim lagi di sini karena authorize() perlu keduanya lagi
                untuk mem-verifikasi ulang password + kode 2FA sekaligus. */}
            <input type="hidden" name="username" value={username} />
            <input type="hidden" name="password" value={password} />

            {useRecoveryCode ? (
              <Input
                name="recoveryCode"
                placeholder="XXXX-XXXX"
                autoFocus
                value={recoveryCode}
                onChange={(e) => setRecoveryCode(e.target.value)}
              />
            ) : (
              <>
                <OtpBoxes value={totp} onChange={setTotp} disabled={isPending} />
                <input type="hidden" name="totp" value={totp} />
              </>
            )}

            <button
              type="button"
              className="text-xs text-muted-foreground underline-offset-2 hover:underline"
              onClick={() => {
                setUseRecoveryCode((prev) => !prev)
                setTotp("")
                setRecoveryCode("")
              }}
            >
              {useRecoveryCode ? "Pakai kode authenticator" : "Tidak bisa akses authenticator?"}
            </button>

            {modalError ? <p className="text-destructive text-sm">{modalError}</p> : null}

            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? "Memverifikasi..." : "Verifikasi Kode"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
