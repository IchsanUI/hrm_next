import { randomBytes } from "crypto"

import bcrypt from "bcryptjs"

import { prisma } from "@/lib/prisma"

// Alfabet tanpa karakter yang gampang tertukar (0/O, 1/I/l) — kode pemulihan
// diketik manual oleh user, jadi ambiguitas visual harus dihindari.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

function randomSegment(length: number): string {
  const bytes = randomBytes(length)
  let out = ""
  for (let i = 0; i < length; i++) {
    out += ALPHABET[bytes[i]! % ALPHABET.length]
  }
  return out
}

// Format "XXXX-XXXX" — cukup panjang (8 karakter dari alfabet 33-an =
// ~39 bit entropy) untuk tidak ditebak, tapi masih nyaman diketik manual.
export function generateRecoveryCodes(count = 10): string[] {
  const codes: string[] = []
  for (let i = 0; i < count; i++) {
    codes.push(`${randomSegment(4)}-${randomSegment(4)}`)
  }
  return codes
}

export async function hashRecoveryCodes(codes: string[]): Promise<string[]> {
  return Promise.all(codes.map((code) => bcrypt.hash(code, 10)))
}

// Cocokkan kode yang diketik user terhadap kode pemulihan yang belum
// terpakai milik akun tsb — begitu cocok, langsung ditandai usedAt supaya
// tidak bisa dipakai ulang (satu kode = satu kali pakai).
export async function verifyAndConsumeRecoveryCode(
  userId: number,
  code: string
): Promise<boolean> {
  const unused = await prisma.totpRecoveryCode.findMany({
    where: { userId, usedAt: null },
  })

  for (const row of unused) {
    const matches = await bcrypt.compare(code, row.codeHash)
    if (matches) {
      await prisma.totpRecoveryCode.update({
        where: { id: row.id },
        data: { usedAt: new Date() },
      })
      return true
    }
  }
  return false
}
