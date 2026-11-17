import { readFile } from "fs/promises"
import path from "path"

import sharp from "sharp"

import { prisma } from "@/lib/prisma"
import { renderMemoOpening } from "@/lib/health-claim-memo"
import { DISPOSITION_LABEL } from "@/lib/health-claim-labels"

// Data cetak Nota Dinas (PDF) — bentuknya mengikuti contoh Nota Dinas yang
// dipakai kantor: kepala surat, pembuka, tabel rincian, total, penutup, tanda
// tangan penyetuju, dan kotak Disposisi Direksi.

export type MemoPrintRow = {
  no: number
  employeeName: string
  balance: number
  patient: string
  amount: number
  note: string
}
export type MemoPrintSigner = { label: string; name: string; signature: Buffer | null; signed: boolean; date: string | null }
export type MemoPrintData = {
  memoNumber: string
  letterNumber: string | null
  isFinal: boolean
  statusLabel: string | null // null = final; selain itu dicetak sebagai cap DRAF/keterangan
  toText: string
  fromText: string
  dateLabel: string
  subject: string
  opening: string
  closing: string
  balanceDateLabel: string
  rows: MemoPrintRow[]
  total: number
  signers: MemoPrintSigner[]
  disposition: { label: string; decision: string | null; note: string | null; name: string; signature: Buffer | null; date: string | null } | null
}

const PUBLIC_UPLOADS = path.join(process.cwd(), "public", "uploads")
async function signatureBuffer(url: string | null | undefined): Promise<Buffer | null> {
  if (!url || !url.startsWith("/uploads/")) return null
  const abs = path.resolve(process.cwd(), "public", `.${url}`)
  if (!abs.startsWith(PUBLIC_UPLOADS + path.sep)) return null
  try {
    return await sharp(await readFile(abs), { failOn: "none" }).png().toBuffer()
  } catch {
    return null
  }
}

function longDate(d: Date) {
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" })
}
function shortDate(d: Date) {
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).replaceAll("/", "-")
}
function actedDate(d: Date | null) {
  return d ? d.toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric", timeZone: "Asia/Jakarta" }) : null
}

export async function getMemoPrintData(publicId: string): Promise<MemoPrintData | null> {
  const memo = await prisma.healthClaimMemo.findUnique({
    where: { publicId },
    include: {
      items: {
        orderBy: { order: "asc" },
        include: { claim: { select: { patientName: true, patientType: true, employee: { select: { fullName: true } } } } },
      },
      steps: {
        orderBy: { order: "asc" },
        include: { approverEmployee: { select: { fullName: true, signatureUrl: true } } },
      },
    },
  })
  if (!memo) return null

  const steps = memo.steps.filter((s) => s.round === memo.round && s.status !== "DILEWATI" && s.status !== "DIBATALKAN")
  const signerSteps = steps.filter((s) => s.type !== "DISPOSISI_DIREKTUR")
  const dispositionStep = steps.find((s) => s.type === "DISPOSISI_DIREKTUR")

  const signers = await Promise.all(
    signerSteps.map(async (s) => {
      const signed = s.status === "DISETUJUI"
      return {
        label: s.label,
        name: s.approverEmployee?.fullName ?? s.actorName ?? "-",
        signature: signed ? await signatureBuffer(s.approverEmployee?.signatureUrl) : null,
        signed,
        date: signed ? actedDate(s.actedAt) : null,
      }
    })
  )

  const acted = dispositionStep && dispositionStep.decision
  const disposition = dispositionStep
    ? {
        label: dispositionStep.label,
        decision: acted ? DISPOSITION_LABEL[dispositionStep.decision!] : null,
        note: dispositionStep.note,
        name: dispositionStep.approverEmployee?.fullName ?? dispositionStep.actorName ?? "-",
        signature: acted ? await signatureBuffer(dispositionStep.approverEmployee?.signatureUrl) : null,
        date: acted ? actedDate(dispositionStep.actedAt) : null,
      }
    : null

  const isFinal = memo.status === "DISETUJUI" || memo.status === "DIBAYAR"
  const statusLabel = isFinal
    ? null
    : memo.status === "DITOLAK"
      ? "TIDAK DISETUJUI"
      : memo.status === "DIBATALKAN"
        ? "DIBATALKAN"
        : "DRAF"

  return {
    memoNumber: memo.memoNumber,
    letterNumber: memo.letterNumber,
    isFinal,
    statusLabel,
    toText: memo.toText,
    fromText: memo.fromText,
    dateLabel: longDate(memo.memoDate),
    subject: memo.subject,
    opening: renderMemoOpening(memo.opening, memo.totalAmount),
    closing: memo.closing,
    balanceDateLabel: shortDate(memo.balanceDate),
    rows: memo.items.map((i, idx) => ({
      no: idx + 1,
      employeeName: i.claim.employee.fullName,
      balance: i.balanceBefore,
      patient: i.claim.patientType === "CHILD" ? `${i.claim.patientName} (Anak)` : i.claim.patientName,
      amount: i.amount,
      note: i.note,
    })),
    total: memo.totalAmount,
    signers,
    disposition,
  }
}
