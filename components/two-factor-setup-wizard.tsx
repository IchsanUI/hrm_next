"use client"

import { useActionState, useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import {
  confirmTwoFactorSetupAction,
  startTwoFactorSetupAction,
  type TwoFactorState,
} from "@/server/actions/two-factor"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

type SetupInfo = { qrDataUrl: string; manualKey: string }

export function TwoFactorSetupWizard({ username }: { username: string }) {
  const router = useRouter()
  const [setupInfo, setSetupInfo] = useState<SetupInfo | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isLoadingSetup, startLoadingSetup] = useTransition()

  const [confirmState, confirmAction, isConfirming] = useActionState<TwoFactorState, FormData>(
    confirmTwoFactorSetupAction,
    undefined
  )

  const [savedCheck, setSavedCheck] = useState(false)

  useEffect(() => {
    startLoadingSetup(async () => {
      const result = await startTwoFactorSetupAction()
      if ("error" in result) {
        setLoadError(result.error)
        return
      }
      setSetupInfo(result)
    })
    // Sengaja hanya sekali saat wizard dibuka — reload halaman akan
    // menghasilkan secret baru (lihat komentar di startTwoFactorSetupAction).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (confirmState && "error" in confirmState && confirmState.error) {
      toast.error(confirmState.error)
    }
  }, [confirmState])

  async function handleCopyManualKey() {
    if (!setupInfo) return
    await navigator.clipboard.writeText(setupInfo.manualKey)
    toast.success("Kunci disalin ke clipboard.")
  }

  const recoveryCodes =
    confirmState && "success" in confirmState && confirmState.success
      ? confirmState.recoveryCodes
      : undefined

  if (recoveryCodes) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Simpan Kode Pemulihan Anda</CardTitle>
          <CardDescription>
            Kode ini HANYA ditampilkan sekali. Simpan di tempat aman (mis. password manager) —
            dipakai untuk masuk kalau Anda kehilangan akses ke aplikasi authenticator.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid grid-cols-2 gap-2 rounded-md border bg-muted/40 p-4 font-mono text-sm">
            {recoveryCodes.map((code) => (
              <span key={code}>{code}</span>
            ))}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-fit"
            onClick={async () => {
              await navigator.clipboard.writeText(recoveryCodes.join("\n"))
              toast.success("Kode pemulihan disalin ke clipboard.")
            }}
          >
            Salin Semua Kode
          </Button>
          <label className="flex items-start gap-2 text-sm">
            <Checkbox
              checked={savedCheck}
              onCheckedChange={(checked) => setSavedCheck(checked === true)}
            />
            Saya sudah menyimpan kode pemulihan ini di tempat yang aman.
          </label>
          <Button
            type="button"
            disabled={!savedCheck}
            onClick={() => {
              router.push("/admin/dashboard")
              router.refresh()
            }}
          >
            Selesai
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pindai Kode QR</CardTitle>
        <CardDescription>
          Buka aplikasi authenticator (Google Authenticator, Authy, dll), pindai kode QR di bawah
          ini untuk akun <span className="font-medium text-foreground">{username}</span>, lalu
          masukkan 6 digit kode yang muncul.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {isLoadingSetup ? (
          <p className="text-sm text-muted-foreground">Menyiapkan kode QR...</p>
        ) : loadError ? (
          <p className="text-destructive text-sm">{loadError}</p>
        ) : setupInfo ? (
          <>
            <img
              src={setupInfo.qrDataUrl}
              alt="Kode QR 2FA"
              className="mx-auto size-48 rounded-md border p-2"
            />
            <div className="grid gap-1">
              <p className="text-xs text-muted-foreground">
                Tidak bisa memindai? Masukkan kunci ini secara manual:
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 truncate rounded-md border bg-muted/40 px-2 py-1.5 text-xs">
                  {setupInfo.manualKey}
                </code>
                <Button type="button" variant="outline" size="sm" onClick={handleCopyManualKey}>
                  Salin
                </Button>
              </div>
            </div>
            <form action={confirmAction} className="grid gap-2">
              <Label htmlFor="code">Kode Verifikasi</Label>
              <Input
                id="code"
                name="code"
                inputMode="numeric"
                placeholder="6 digit"
                autoComplete="one-time-code"
                required
              />
              <Button type="submit" disabled={isConfirming}>
                {isConfirming ? "Memverifikasi..." : "Verifikasi & Aktifkan"}
              </Button>
            </form>
          </>
        ) : null}
      </CardContent>
    </Card>
  )
}
