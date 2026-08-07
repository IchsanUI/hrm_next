"use client"

import { useActionState, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import Link from "next/link"

import {
  disableTwoFactorAction,
  regenerateRecoveryCodesAction,
  type TwoFactorState,
} from "@/server/actions/two-factor"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PasswordInput } from "@/components/ui/password-input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"

function CredentialConfirmForm({
  action,
  submitLabel,
  onSuccess,
}: {
  action: (prevState: TwoFactorState, formData: FormData) => Promise<TwoFactorState>
  submitLabel: string
  onSuccess: (state: TwoFactorState) => void
}) {
  const [state, formAction, isPending] = useActionState<TwoFactorState, FormData>(
    action,
    undefined
  )
  const wasPending = useRef(false)

  useEffect(() => {
    if (!wasPending.current || isPending) {
      wasPending.current = isPending
      return
    }
    wasPending.current = isPending
    if (state && "error" in state && state.error) {
      toast.error(state.error)
      return
    }
    if (state && "success" in state && state.success) {
      onSuccess(state)
    }
    // onSuccess sengaja tidak dimasukkan ke deps — dipanggil sekali per
    // transisi pending->selesai, bukan tiap kali referensinya berubah.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPending, state])

  return (
    <form action={formAction} className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="currentPassword">Password Saat Ini</Label>
        <PasswordInput id="currentPassword" name="currentPassword" required />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="code">Kode 2FA</Label>
        <Input id="code" name="code" inputMode="numeric" placeholder="6 digit" required />
      </div>
      {state && "error" in state && state.error ? (
        <p className="text-destructive text-sm">{state.error}</p>
      ) : null}
      <DialogFooter>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Memproses..." : submitLabel}
        </Button>
      </DialogFooter>
    </form>
  )
}

function RecoveryCodesDisplay({ codes }: { codes: string[] }) {
  return (
    <div className="grid gap-3">
      <p className="text-sm text-muted-foreground">
        Kode lama tidak berlaku lagi. Simpan kode baru ini — hanya ditampilkan sekali.
      </p>
      <div className="grid grid-cols-2 gap-2 rounded-md border bg-muted/40 p-4 font-mono text-sm">
        {codes.map((code) => (
          <span key={code}>{code}</span>
        ))}
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-fit"
        onClick={async () => {
          await navigator.clipboard.writeText(codes.join("\n"))
          toast.success("Kode pemulihan disalin ke clipboard.")
        }}
      >
        Salin Semua Kode
      </Button>
    </div>
  )
}

export function TwoFactorSettingsCard({ enabled }: { enabled: boolean }) {
  const [disableOpen, setDisableOpen] = useState(false)
  const [regenOpen, setRegenOpen] = useState(false)
  const [newRecoveryCodes, setNewRecoveryCodes] = useState<string[] | null>(null)

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle>Autentikasi Dua Faktor (2FA)</CardTitle>
          <Badge variant={enabled ? "default" : "outline"}>{enabled ? "Aktif" : "Nonaktif"}</Badge>
        </div>
        <CardDescription>
          Wajib aktif untuk akun Super Admin. Kode 6 digit dari aplikasi authenticator diminta
          setiap kali login.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {!enabled ? (
          <Button render={<Link href="/admin/keamanan/2fa/setup" />} nativeButton={false}>
            Aktifkan 2FA
          </Button>
        ) : (
          <>
            <Button variant="destructive" onClick={() => setDisableOpen(true)}>
              Nonaktifkan 2FA
            </Button>
            <Dialog open={disableOpen} onOpenChange={setDisableOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Nonaktifkan 2FA</DialogTitle>
                  <DialogDescription>
                    Masukkan password dan kode 2FA saat ini untuk mengonfirmasi. Anda tetap bisa
                    mengaktifkannya lagi kapan saja lewat halaman ini.
                  </DialogDescription>
                </DialogHeader>
                <CredentialConfirmForm
                  action={disableTwoFactorAction}
                  submitLabel="Nonaktifkan"
                  onSuccess={() => {
                    toast.success("2FA berhasil dinonaktifkan.")
                    setDisableOpen(false)
                  }}
                />
              </DialogContent>
            </Dialog>

            <Button variant="outline" onClick={() => setRegenOpen(true)}>
              Buat Ulang Kode Pemulihan
            </Button>
            <Dialog
              open={regenOpen}
              onOpenChange={(open) => {
                setRegenOpen(open)
                if (!open) setNewRecoveryCodes(null)
              }}
            >
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Buat Ulang Kode Pemulihan</DialogTitle>
                  <DialogDescription>
                    10 kode pemulihan lama akan langsung tidak berlaku, diganti 10 kode baru.
                  </DialogDescription>
                </DialogHeader>
                {newRecoveryCodes ? (
                  <RecoveryCodesDisplay codes={newRecoveryCodes} />
                ) : (
                  <CredentialConfirmForm
                    action={regenerateRecoveryCodesAction}
                    submitLabel="Buat Ulang"
                    onSuccess={(state) => {
                      if (state && "recoveryCodes" in state && state.recoveryCodes) {
                        setNewRecoveryCodes(state.recoveryCodes)
                      }
                    }}
                  />
                )}
              </DialogContent>
            </Dialog>
          </>
        )}
      </CardContent>
    </Card>
  )
}
