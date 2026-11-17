import { readFile } from "fs/promises"

import sharp from "sharp"
import { PDFDocument, StandardFonts, rgb, type PDFEmbeddedPage, type PDFFont, type PDFImage } from "pdf-lib"

import { resolveClaimFile } from "@/lib/health-claim-storage"

// Lampiran bukti klaim di belakang PDF Nota Dinas. Supaya hemat kertas, satu
// halaman A4 memuat DUA bukti: berdampingan bila keduanya tegak (nota/struk
// biasanya memanjang), atau atas-bawah bila mendatar. Tiap bukti diskalakan
// agar muat utuh (tidak dipotong) di petaknya dan tetap terbaca.

export type ReceiptSource = {
  label: string // mis. "KLM-2026-0001 · MOCHAMMAD ICHSAN · Kacamata"
  storedFileName: string
  originalName: string
}

type Piece =
  | { kind: "image"; label: string; image: PDFImage; width: number; height: number }
  | { kind: "page"; label: string; page: PDFEmbeddedPage; width: number; height: number }
  | { kind: "missing"; label: string; reason: string; width: number; height: number }

const A4 = { width: 595.28, height: 841.89 }
const MARGIN = 26
const HEADER = 22
const FOOTER = 18
const GAP = 12
const LABEL_H = 13

function winAnsi(text: string) {
  return text.replace(/[^\x20-\x7E -ÿ–—…•]/g, "?")
}
function fit(text: string, font: PDFFont, size: number, max: number) {
  let v = winAnsi(text)
  if (font.widthOfTextAtSize(v, size) <= max) return v
  while (v.length > 1 && font.widthOfTextAtSize(`${v}…`, size) > max) v = v.slice(0, -1)
  return `${v}…`
}

async function loadPieces(doc: PDFDocument, sources: ReceiptSource[]): Promise<Piece[]> {
  const pieces: Piece[] = []
  for (const src of sources) {
    const path = resolveClaimFile(src.storedFileName)
    if (!path) {
      pieces.push({ kind: "missing", label: src.label, reason: `${src.originalName}: file tidak ditemukan`, width: 1, height: 1 })
      continue
    }
    try {
      const bytes = await readFile(path)
      if (bytes.subarray(0, 5).toString("latin1") === "%PDF-") {
        const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false })
        const pages = await doc.embedPdf(pdf, pdf.getPageIndices())
        pages.forEach((page, i) =>
          pieces.push({
            kind: "page",
            label: pages.length > 1 ? `${src.label} (hal. ${i + 1}/${pages.length})` : src.label,
            page,
            width: page.width,
            height: page.height,
          })
        )
      } else {
        // Orientasi EXIF diterapkan & resolusi dibatasi (±300 dpi untuk setengah A4).
        const { data, info } = await sharp(bytes, { failOn: "none" })
          .rotate()
          .resize({ width: 1800, height: 1800, fit: "inside", withoutEnlargement: true })
          .flatten({ background: "#ffffff" })
          .jpeg({ quality: 85 })
          .toBuffer({ resolveWithObject: true })
        pieces.push({ kind: "image", label: src.label, image: await doc.embedJpg(data), width: info.width, height: info.height })
      }
    } catch {
      pieces.push({ kind: "missing", label: src.label, reason: `${src.originalName}: file tidak dapat ditampilkan`, width: 1, height: 1 })
    }
  }
  return pieces
}

export async function appendClaimReceipts(doc: PDFDocument, sources: ReceiptSource[], memoNumber: string) {
  if (sources.length === 0) return
  const pieces = await loadPieces(doc, sources)
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const totalPages = Math.ceil(pieces.length / 2)

  for (let p = 0; p < totalPages; p++) {
    const pair = pieces.slice(p * 2, p * 2 + 2)
    const page = doc.addPage([A4.width, A4.height])
    const contentTop = A4.height - MARGIN - HEADER
    const contentBottom = MARGIN + FOOTER
    const contentW = A4.width - MARGIN * 2
    const contentH = contentTop - contentBottom

    page.drawText(winAnsi(`LAMPIRAN BUKTI KLAIM · Nota Dinas ${memoNumber}`), {
      x: MARGIN,
      y: A4.height - MARGIN - 10,
      size: 9,
      font: bold,
      color: rgb(0.1, 0.15, 0.3),
    })
    page.drawLine({
      start: { x: MARGIN, y: contentTop + 6 },
      end: { x: A4.width - MARGIN, y: contentTop + 6 },
      thickness: 0.6,
      color: rgb(0.75, 0.78, 0.84),
    })
    page.drawText(`Lampiran hal. ${p + 1}/${totalPages}`, {
      x: A4.width - MARGIN - font.widthOfTextAtSize(`Lampiran hal. ${p + 1}/${totalPages}`, 7),
      y: MARGIN,
      size: 7,
      font,
      color: rgb(0.5, 0.5, 0.5),
    })

    // Dua bukti tegak → berdampingan; selain itu → atas-bawah.
    const sideBySide = pair.length === 2 && pair.every((x) => x.kind !== "missing" && x.height >= x.width)
    const slots = pair.map((_, i) =>
      sideBySide
        ? { x: MARGIN + i * ((contentW + GAP) / 2), y: contentBottom, w: (contentW - GAP) / 2, h: contentH }
        : pair.length === 1
          ? { x: MARGIN, y: contentBottom, w: contentW, h: contentH }
          : {
              x: MARGIN,
              y: contentBottom + (1 - i) * ((contentH + GAP) / 2),
              w: contentW,
              h: (contentH - GAP) / 2,
            }
    )

    pair.forEach((piece, i) => {
      const slot = slots[i]
      page.drawText(fit(piece.label, bold, 8, slot.w), {
        x: slot.x,
        y: slot.y + slot.h - 8,
        size: 8,
        font: bold,
        color: rgb(0.2, 0.2, 0.2),
      })
      const boxH = slot.h - LABEL_H
      page.drawRectangle({
        x: slot.x,
        y: slot.y,
        width: slot.w,
        height: boxH,
        borderColor: rgb(0.82, 0.84, 0.88),
        borderWidth: 0.6,
      })
      if (piece.kind === "missing") {
        page.drawText(fit(piece.reason, font, 9, slot.w - 16), {
          x: slot.x + 8,
          y: slot.y + boxH / 2,
          size: 9,
          font,
          color: rgb(0.45, 0.45, 0.45),
        })
        return
      }
      const pad = 4
      const ratio = Math.min((slot.w - pad * 2) / piece.width, (boxH - pad * 2) / piece.height)
      const w = piece.width * ratio
      const h = piece.height * ratio
      const x = slot.x + (slot.w - w) / 2
      const y = slot.y + (boxH - h) / 2
      if (piece.kind === "image") page.drawImage(piece.image, { x, y, width: w, height: h })
      else page.drawPage(piece.page, { x, y, width: w, height: h })
    })
  }
}
