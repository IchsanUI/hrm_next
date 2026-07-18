"use client"

import { useActionState, useEffect, useState } from "react"
import { toast } from "sonner"
import { Check, X } from "lucide-react"

import {
  updateUsernameAction,
  updatePasswordAction,
  type AccountFormState,
} from "@/server/actions/account"
import { passwordRules } from "@/lib/validations/account"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

const PASSWORD_CHECKLIST: { label: string; test: (value: string) => boolean }[] = [
  { label: `Minimal ${passwordRules.minLength} karakter`, test: (v) => v.length >= passwordRules.minLength },
  { label: "Mengandung huruf besar (A-Z)", test: (v) => passwordRules.hasUpper.test(v) },
  { label: "Mengandung huruf kecil (a-z)", test: (v) => passwordRules.hasLower.test(v) },
  { label: "Mengandung angka (0-9)", test: (v) => passwordRules.hasNumber.test(v) },
  { label: "Mengandung karakter spesial (!@#$dst)", test: (v) => passwordRules.hasSpecial.test(v) },
]

function PasswordChecklist({ value }: { value: string }) {
  return (
    <ul className="grid gap-1 text-xs">
      {PASSWORD_CHECKLIST.map((rule) => {
        const passed = rule.test(value)
        return (
          <li
            key={rule.label}
            className={cn(
              "flex items-center gap-1.5",
              passed ? "text-emerald-600" : "text-muted-foreground"
            )}
          >
            {passed ? <Check className="size-3.5" /> : <X className="size-3.5" />}
            {rule.label}
          </li>
        )
      })}
    </ul>
  )
}

export function AccountSettingsForm({ currentUsername }: { currentUsername: string }) {
  const [usernameState, usernameAction, isUsernamePending] = useActionState<
    AccountFormState,
    FormData
  >(updateUsernameAction, undefined)

  const [passwordState, passwordAction, isPasswordPending] = useActionState<
    AccountFormState,
    FormData
  >(updatePasswordAction, undefined)

  const [newPassword, setNewPassword] = useState("")

  useEffect(() => {
    if (usernameState?.error) toast.error(usernameState.error)
  }, [usernameState])

  useEffect(() => {
    if (passwordState?.error) toast.error(passwordState.error)
  }, [passwordState])

  return (
    <div className="grid gap-6">
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Ubah Username</CardTitle>
          <CardDescription>
            Username saat ini: <span className="font-medium text-foreground">{currentUsername}</span>.
            Setelah diubah, Anda akan diminta login ulang.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={usernameAction} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="username">Username Baru</Label>
              <Input id="username" name="username" defaultValue={currentUsername} required />
            </div>
            {usernameState?.error ? (
              <p className="text-destructive text-sm">{usernameState.error}</p>
            ) : null}
            <div>
              <Button type="submit" disabled={isUsernamePending}>
                {isUsernamePending ? "Menyimpan..." : "Simpan Username"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Ubah Password</CardTitle>
          <CardDescription>
            Setelah diubah, Anda akan diminta login ulang dengan password baru.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={passwordAction} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="currentPassword">Password Saat Ini</Label>
              <Input
                id="currentPassword"
                name="currentPassword"
                type="password"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="newPassword">Password Baru</Label>
              <Input
                id="newPassword"
                name="newPassword"
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <PasswordChecklist value={newPassword} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="confirmPassword">Konfirmasi Password Baru</Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                required
              />
            </div>
            {passwordState?.error ? (
              <p className="text-destructive text-sm">{passwordState.error}</p>
            ) : null}
            <div>
              <Button type="submit" disabled={isPasswordPending}>
                {isPasswordPending ? "Menyimpan..." : "Simpan Password"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
