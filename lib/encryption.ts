import { createCipheriv, createDecipheriv, randomBytes } from "crypto"

// Enkripsi field data pegawai yang sensitif (NIK, data kesehatan) memakai
// AES-256-GCM. Format nilai tersimpan: "enc:v1:<base64(iv|authTag|ciphertext)>".
// Kunci diambil dari EMPLOYEE_DATA_ENCRYPTION_KEY (base64, 32 byte).

const PREFIX = "enc:v1:"
const IV_LENGTH = 12
const AUTH_TAG_LENGTH = 16

function getKey(): Buffer {
  const raw = process.env.EMPLOYEE_DATA_ENCRYPTION_KEY
  if (!raw) {
    throw new Error(
      "EMPLOYEE_DATA_ENCRYPTION_KEY belum diset. Tambahkan di .env (32 byte, base64)."
    )
  }
  const key = Buffer.from(raw, "base64")
  if (key.length !== 32) {
    throw new Error(
      "EMPLOYEE_DATA_ENCRYPTION_KEY harus 32 byte setelah didecode base64."
    )
  }
  return key
}

export function encryptField(plainText: string): string {
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv)
  const ciphertext = Buffer.concat([
    cipher.update(plainText, "utf8"),
    cipher.final(),
  ])
  const authTag = cipher.getAuthTag()
  const payload = Buffer.concat([iv, authTag, ciphertext])
  return PREFIX + payload.toString("base64")
}

export function decryptField(storedValue: string): string {
  if (!storedValue.startsWith(PREFIX)) {
    throw new Error(
      "Nilai tidak terenkripsi dengan format yang dikenali (data lama sebelum enkripsi diaktifkan?). Jalankan ulang seed/migrasi data."
    )
  }
  const payload = Buffer.from(storedValue.slice(PREFIX.length), "base64")
  const iv = payload.subarray(0, IV_LENGTH)
  const authTag = payload.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH)
  const ciphertext = payload.subarray(IV_LENGTH + AUTH_TAG_LENGTH)

  const decipher = createDecipheriv("aes-256-gcm", getKey(), iv)
  decipher.setAuthTag(authTag)
  const plainText = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ])
  return plainText.toString("utf8")
}
