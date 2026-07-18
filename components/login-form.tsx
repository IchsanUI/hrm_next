"use client"

import { useActionState } from "react"
import Image from "next/image"

import { loginAction } from "@/server/actions/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
    <Card className="w-full max-w-sm">
      <CardHeader>
        <Image
          src="/LogoSystem.png"
          alt="Logo"
          width={56}
          height={56}
          className="mx-auto mb-2"
        />
        <CardTitle className="text-center">Masuk ke HRM</CardTitle>
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
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </div>
          {state?.error ? (
            <p className="text-destructive text-sm">{state.error}</p>
          ) : null}
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? "Memproses..." : "Masuk"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
