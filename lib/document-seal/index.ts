import { randomBytes } from "crypto"
import QRCode from "qrcode"
import { Prisma, type DocumentSeal } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import { getSealServiceConfig } from "@/lib/document-seal/config"
import { SealServiceError, sealServiceFetch, sha256Hex } from "@/lib/document-seal/http"
import { DOCUMENT_SEAL_TYPES, type DocumentSealKindValue, type DocumentSealSourceType } from "@/lib/document-seal/registry"

// Satu pintu untuk semua QR di HRIS. Dokumen yang butuh QR (TTD digital atau
// stempel) memanggil getDocumentQr(); HRIS meminta segel ke Layanan Segel
// Dokumen, menyimpannya di tabel document_seals, lalu memakai ulang segel yang
// sama selama isi dokumen tidak berubah. Kontrak API: docs/integrasi-segel-dokumen.md.

export type SealSummaryField = { label: string; value: string }

export type DocumentSealRequest = {
  sourceType: DocumentSealSourceType
  sourceId: string | number
  documentNumber: string
  title: string
  /** Data penting dokumen. Di-hash jadi contentDigest; berubah ⇒ segel baru. */
  content: unknown
  /** Ringkasan yang ditampilkan di halaman verifikasi layanan segel. */
  summary: SealSummaryField[]
  /** Timpa penanda tangan bawaan registry (mis. NIP pejabat tertentu). */
  signer?: { kind?: DocumentSealKindValue; ref: string; name?: string }
  requestedById?: number | null
}

export type DocumentQrResult =
  | { mode: "sealed"; dataUrl: string; verifyUrl: string | null; seal: DocumentSeal }
  | { mode: "pending" | "unavailable"; dataUrl: string | null; seal: DocumentSeal | null; message: string }
  | { mode: "local"; dataUrl: string | null }

type RemoteSeal = {
  id: string
  status: "PENDING" | "ISSUED" | "REJECTED" | "REVOKED"
  verifyUrl?: string | null
  qrPayload?: string | null
  issuedAt?: string | null
  reason?: string | null
}

const PENDING_REFRESH_MS = 60_000

export function isSealServiceEnabled() {
  return getSealServiceConfig() !== null
}

/** JSON dengan kunci terurut agar hash stabil apa pun urutan propertinya. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value ?? null)
  if (value instanceof Date) return JSON.stringify(value.toISOString())
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`
}

function qrDataUrl(payload: string, width: number) {
  return QRCode.toDataURL(payload, { margin: 0, width, errorCorrectionLevel: "M" })
}

function remoteToData(remote: RemoteSeal): Prisma.DocumentSealUpdateInput {
  return {
    externalId: remote.id,
    status: remote.status,
    verifyUrl: remote.verifyUrl ?? null,
    qrPayload: remote.qrPayload ?? remote.verifyUrl ?? null,
    issuedAt: remote.issuedAt ? new Date(remote.issuedAt) : remote.status === "ISSUED" ? new Date() : null,
    errorMessage: remote.status === "REJECTED" ? (remote.reason ?? "Ditolak penanda tangan.").slice(0, 500) : null,
  }
}

/**
 * Pastikan dokumen punya segel. Idempoten: memakai ulang segel dengan isi yang
 * sama, mencoba ulang yang FAILED, dan memperbarui yang masih PENDING.
 * Mengembalikan null bila layanan segel belum dikonfigurasi.
 */
export async function ensureDocumentSeal(input: DocumentSealRequest): Promise<DocumentSeal | null> {
  const config = getSealServiceConfig()
  if (!config) return null

  const preset = DOCUMENT_SEAL_TYPES[input.sourceType]
  const kind = input.signer?.kind ?? preset.kind
  const signerRef = input.signer?.ref ?? preset.signerRef
  const signerName = input.signer?.name ?? preset.signerName
  const sourceId = String(input.sourceId)
  const contentDigest = sha256Hex(canonicalJson(input.content))
  const key = { sourceType: input.sourceType, sourceId, kind, signerRef, contentDigest }

  let seal = await prisma.documentSeal.findUnique({ where: { sourceType_sourceId_kind_signerRef_contentDigest: key } })
  if (seal?.status === "ISSUED" || seal?.status === "REJECTED" || seal?.status === "REVOKED") return seal

  // Masih menunggu persetujuan: tanya status terbaru sesekali (callback bisa terlambat).
  if (seal?.status === "PENDING" && seal.externalId) {
    if (Date.now() - seal.updatedAt.getTime() < PENDING_REFRESH_MS) return seal
    try {
      const remote = await sealServiceFetch<RemoteSeal>(config, "GET", `/v1/seals/${encodeURIComponent(seal.externalId)}`)
      return prisma.documentSeal.update({ where: { id: seal.id }, data: remoteToData(remote) })
    } catch {
      return prisma.documentSeal.update({ where: { id: seal.id }, data: { updatedAt: new Date() } })
    }
  }

  if (!seal) {
    try {
      seal = await prisma.documentSeal.create({
        data: {
          ...key,
          publicId: randomBytes(12).toString("base64url"),
          documentNumber: input.documentNumber.slice(0, 100),
          title: input.title.slice(0, 255),
          signerName: signerName?.slice(0, 150) ?? null,
          requestedById: input.requestedById ?? null,
        },
      })
    } catch (error) {
      // Dua cetakan bersamaan: pakai baris yang dibuat permintaan lain.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return prisma.documentSeal.findUnique({ where: { sourceType_sourceId_kind_signerRef_contentDigest: key } })
      }
      throw error
    }
  }

  try {
    const remote = await sealServiceFetch<RemoteSeal>(config, "POST", "/v1/seals", {
      clientReference: seal.publicId,
      sourceType: seal.sourceType,
      sourceId: seal.sourceId,
      documentType: preset.label,
      documentNumber: seal.documentNumber,
      title: seal.title,
      kind: seal.kind,
      signer: { ref: seal.signerRef, name: seal.signerName },
      contentDigest: seal.contentDigest,
      summary: input.summary,
      callbackUrl: config.callbackUrl,
    })
    return prisma.documentSeal.update({ where: { id: seal.id }, data: remoteToData(remote) })
  } catch (error) {
    const message = error instanceof SealServiceError ? error.message : "Kesalahan tak terduga saat meminta segel."
    console.error("[document-seal] gagal meminta segel", { sourceType: seal.sourceType, sourceId: seal.sourceId, message })
    return prisma.documentSeal.update({ where: { id: seal.id }, data: { status: "FAILED", errorMessage: message.slice(0, 500) } })
  }
}

/**
 * QR siap tempel ke PDF (data URL PNG).
 * - Layanan belum dikonfigurasi → QR lokal dari `fallbackPayload` (perilaku lama).
 * - Segel terbit → QR dari layanan.
 * - Pending/gagal/ditolak → `fallbackPayload` bila diberikan (masa transisi),
 *   selain itu tanpa QR. Pemanggil bisa menampilkan keterangan dari `message`.
 */
export async function getDocumentQr(
  input: DocumentSealRequest,
  options: { fallbackPayload?: string | null; width?: number } = {}
): Promise<DocumentQrResult> {
  const width = options.width ?? 200
  const fallback = options.fallbackPayload ? await qrDataUrl(options.fallbackPayload, width) : null

  const seal = await ensureDocumentSeal(input)
  if (!seal) return { mode: "local", dataUrl: fallback }
  if (seal.status === "ISSUED" && seal.qrPayload) {
    return { mode: "sealed", dataUrl: await qrDataUrl(seal.qrPayload, width), verifyUrl: seal.verifyUrl, seal }
  }
  const message =
    seal.status === "PENDING"
      ? "Menunggu persetujuan penanda tangan."
      : seal.status === "REJECTED"
        ? `Segel ditolak: ${seal.errorMessage ?? "-"}`
        : seal.status === "REVOKED"
          ? "Segel sudah dicabut."
          : (seal.errorMessage ?? "Layanan segel tidak tersedia.")
  return { mode: seal.status === "PENDING" ? "pending" : "unavailable", dataUrl: fallback, seal, message }
}

/** Cabut semua segel aktif milik dokumen (mis. dokumen dibatalkan/dikoreksi). */
export async function revokeDocumentSeals(sourceType: DocumentSealSourceType, sourceId: string | number, reason: string) {
  const config = getSealServiceConfig()
  const seals = await prisma.documentSeal.findMany({
    where: { sourceType, sourceId: String(sourceId), status: { in: ["ISSUED", "PENDING"] } },
  })
  for (const seal of seals) {
    if (config && seal.externalId) {
      try {
        await sealServiceFetch(config, "POST", `/v1/seals/${encodeURIComponent(seal.externalId)}/revoke`, { reason })
      } catch (error) {
        // Tetap tandai dicabut di HRIS; catat agar bisa dicabut manual di layanan.
        console.error("[document-seal] gagal mencabut di layanan", { id: seal.externalId, error: String(error) })
      }
    }
    await prisma.documentSeal.update({
      where: { id: seal.id },
      data: { status: "REVOKED", revokedAt: new Date(), revokeReason: reason.slice(0, 500) },
    })
  }
  return seals.length
}

export type SealWebhookPayload = {
  event: "seal.issued" | "seal.rejected" | "seal.revoked"
  seal: RemoteSeal & { clientReference: string }
}

/** Terapkan callback dari layanan segel. Mengembalikan false bila segel tidak dikenal. */
export async function applySealWebhook(payload: SealWebhookPayload): Promise<boolean> {
  const seal = await prisma.documentSeal.findUnique({ where: { publicId: payload.seal.clientReference } })
  if (!seal) return false
  if (seal.externalId && seal.externalId !== payload.seal.id) return false

  const data = remoteToData(payload.seal)
  if (payload.event === "seal.revoked" || payload.seal.status === "REVOKED") {
    data.status = "REVOKED"
    data.revokedAt = new Date()
    data.revokeReason = payload.seal.reason?.slice(0, 500) ?? null
  }
  await prisma.documentSeal.update({ where: { id: seal.id }, data })
  return true
}
