"use server"

import QRCode from "qrcode"
import bcrypt from "bcryptjs"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity-log"
import { buildOtpAuthUri, generateTotpSecret, verifyTotpCode } from "@/lib/auth/totp"
import { decryptTotpSecret, encryptTotpSecret } from "@/lib/auth/totp-encryption"
import { generateRecoveryCodes, hashRecoveryCodes } from "@/lib/auth/totp-recovery-codes"
import {
  confirmTotpSetupSchema,
  disableTwoFactorSchema,
  regenerateRecoveryCodesSchema,
} from "@/lib/validations/two-factor"

export type TwoFactorState =
  | { error?: string; success?: boolean; recoveryCodes?: string[] }
  | undefined

type SuperAdminContext = { error: string } | { userId: number; username: string }

async function requireSuperAdminSession(): Promise<SuperAdminContext> {
  const session = await auth()
  if (!session?.user) {
    return { error: "Sesi tidak valid, silakan login ulang." }
  }
  if (session.user.role !== "SUPER_ADMIN") {
    return { error: "Hanya Super Admin yang bisa mengelola 2FA." }
  }
  return { userId: Number(session.user.id), username: session.user.username }
}

function isSuperAdminError(ctx: SuperAdminContext): ctx is { error: string } {
  return "error" in ctx
}

// Generate secret BARU tiap kali wizard dipanggil (overwrite yang lama kalau
// ada) — status "pending" (totpSecret terisi, totpEnabledAt masih null)
// sampai dikonfirmasi lewat confirmTwoFactorSetupAction. authorize() di
// auth.ts sengaja mengecek totpEnabledAt (bukan cuma totpSecret) supaya
// secret pending yang ditinggal begitu saja tidak ikut menggerbang login.
export async function startTwoFactorSetupAction(): Promise<
  { error: string } | { qrDataUrl: string; manualKey: string }
> {
  const ctx = await requireSuperAdminSession()
  if (isSuperAdminError(ctx)) return ctx

  const secret = generateTotpSecret()
  await prisma.user.update({
    where: { id: ctx.userId },
    data: { totpSecret: encryptTotpSecret(secret) },
  })

  const otpAuthUri = buildOtpAuthUri(secret, ctx.username)
  const qrDataUrl = await QRCode.toDataURL(otpAuthUri)
  return { qrDataUrl, manualKey: secret }
}

export async function confirmTwoFactorSetupAction(
  _prevState: TwoFactorState,
  formData: FormData
): Promise<TwoFactorState> {
  const ctx = await requireSuperAdminSession()
  if (isSuperAdminError(ctx)) return ctx

  const parsed = confirmTotpSetupSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Kode tidak valid." }
  }

  const user = await prisma.user.findUnique({ where: { id: ctx.userId } })
  if (!user?.totpSecret) {
    return { error: "Belum ada proses setup 2FA yang berjalan. Mulai ulang dari awal." }
  }

  const secret = decryptTotpSecret(user.totpSecret)
  if (!(await verifyTotpCode(parsed.data.code, secret))) {
    return { error: "Kode salah. Pastikan waktu di perangkat Anda akurat, lalu coba lagi." }
  }

  const recoveryCodes = generateRecoveryCodes()
  const hashedCodes = await hashRecoveryCodes(recoveryCodes)

  await prisma.$transaction([
    prisma.user.update({ where: { id: ctx.userId }, data: { totpEnabledAt: new Date() } }),
    prisma.totpRecoveryCode.deleteMany({ where: { userId: ctx.userId } }),
    prisma.totpRecoveryCode.createMany({
      data: hashedCodes.map((codeHash) => ({ userId: ctx.userId, codeHash })),
    }),
  ])

  await logActivity({
    userId: ctx.userId,
    username: ctx.username,
    action: "ENABLE_2FA",
    entityType: "User",
    description: `${ctx.username} mengaktifkan autentikasi dua faktor (2FA).`,
  })

  return { success: true, recoveryCodes }
}

export async function disableTwoFactorAction(
  _prevState: TwoFactorState,
  formData: FormData
): Promise<TwoFactorState> {
  const ctx = await requireSuperAdminSession()
  if (isSuperAdminError(ctx)) return ctx

  const parsed = disableTwoFactorSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Data tidak valid." }
  }

  const user = await prisma.user.findUnique({ where: { id: ctx.userId } })
  if (!user?.totpEnabledAt || !user.totpSecret) {
    return { error: "2FA belum aktif di akun ini." }
  }

  const passwordOk = await bcrypt.compare(parsed.data.currentPassword, user.password)
  if (!passwordOk) {
    return { error: "Password saat ini salah." }
  }

  const secret = decryptTotpSecret(user.totpSecret)
  if (!(await verifyTotpCode(parsed.data.code, secret))) {
    return { error: "Kode 2FA salah." }
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: ctx.userId },
      data: { totpSecret: null, totpEnabledAt: null },
    }),
    prisma.totpRecoveryCode.deleteMany({ where: { userId: ctx.userId } }),
  ])

  // TIDAK signOut — session.user.twoFactorEnabled direfresh dari DB tiap
  // request lewat jwt callback (auth.config.ts), efektif seketika di
  // request berikutnya tanpa perlu re-login. Beda dari ganti
  // username/password (lihat server/actions/account.ts) yang memang
  // mengubah kredensial itu sendiri — di sini user sudah membuktikan kedua
  // faktor (password + kode 2FA) untuk sampai ke aksi ini, jadi memaksa
  // logout tidak menambah keamanan, cuma menambah friksi.
  await logActivity({
    userId: ctx.userId,
    username: ctx.username,
    action: "DISABLE_2FA",
    entityType: "User",
    description: `${ctx.username} menonaktifkan autentikasi dua faktor (2FA).`,
  })

  return { success: true }
}

export async function regenerateRecoveryCodesAction(
  _prevState: TwoFactorState,
  formData: FormData
): Promise<TwoFactorState> {
  const ctx = await requireSuperAdminSession()
  if (isSuperAdminError(ctx)) return ctx

  const parsed = regenerateRecoveryCodesSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Data tidak valid." }
  }

  const user = await prisma.user.findUnique({ where: { id: ctx.userId } })
  if (!user?.totpEnabledAt || !user.totpSecret) {
    return { error: "2FA belum aktif di akun ini." }
  }

  const passwordOk = await bcrypt.compare(parsed.data.currentPassword, user.password)
  if (!passwordOk) {
    return { error: "Password saat ini salah." }
  }

  const secret = decryptTotpSecret(user.totpSecret)
  if (!(await verifyTotpCode(parsed.data.code, secret))) {
    return { error: "Kode 2FA salah." }
  }

  const recoveryCodes = generateRecoveryCodes()
  const hashedCodes = await hashRecoveryCodes(recoveryCodes)

  await prisma.$transaction([
    prisma.totpRecoveryCode.deleteMany({ where: { userId: ctx.userId } }),
    prisma.totpRecoveryCode.createMany({
      data: hashedCodes.map((codeHash) => ({ userId: ctx.userId, codeHash })),
    }),
  ])

  await logActivity({
    userId: ctx.userId,
    username: ctx.username,
    action: "REGENERATE_2FA_RECOVERY_CODES",
    entityType: "User",
    description: `${ctx.username} membuat ulang kode pemulihan 2FA (kode lama tidak berlaku lagi).`,
  })

  return { success: true, recoveryCodes }
}
