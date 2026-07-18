import { randomBytes } from "crypto"

// Nomor referensi izin yang aman ditampilkan di URL — tidak menebak-nebak
// id internal berurutan seperti /riwayat-izin/2. Format: PREFIX + urutan
// (5 digit, kosmetik saja) + timestamp milidetik + string acak (sumber
// keunikan sebenarnya).
export const REQUEST_PUBLIC_ID_PREFIX = {
  lembur: "LB",
  meninggalkan_kantor: "MK",
  pulang_cepat: "PC",
  terlambat: "TL",
} as const

function randomAlphaNum(length: number) {
  return randomBytes(length)
    .toString("base64")
    .replace(/[^a-zA-Z0-9]/g, "")
    .padEnd(length, "0")
    .slice(0, length)
    .toUpperCase()
}

export function buildRequestPublicId(prefix: string, sequence: number) {
  const seq = String(sequence).padStart(5, "0")
  const ms = Date.now()
  const random = randomAlphaNum(6)
  return `${prefix}${seq}${ms}${random}`
}
