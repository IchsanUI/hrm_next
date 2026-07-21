import { readFile } from "fs/promises"
import path from "path"

import { PDFDocument, StandardFonts, rgb, type PDFPage } from "pdf-lib"
import { renderToBuffer, Document } from "@react-pdf/renderer"

import {
  IzinPrintPdfDocument,
  IzinAttachmentPage,
  type IzinPrintEntry,
} from "@/lib/reports/izin-print-pdf"

const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".gif"]

function isImageUrl(url: string) {
  const lower = url.toLowerCase()
  return IMAGE_EXTENSIONS.some((ext) => lower.endsWith(ext))
}

function formatPrintedAt(date: Date) {
  return date.toLocaleString("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

// Halaman lampiran PDF asli (di-copy apa adanya dari file yang diupload)
// tidak otomatis punya No. Surat/footer kayak halaman surat yang di-render
// react-pdf — digambar manual di sini pakai pdf-lib supaya tetap kelihatan
// satu kesatuan dokumen, bukan seperti nyambung ke dokumen lain yang beda.
async function stampAttachmentPages(
  finalDoc: PDFDocument,
  pages: PDFPage[],
  { publicId, generatedBy, printedAt }: { publicId: string; generatedBy: string; printedAt: string }
) {
  const font = await finalDoc.embedFont(StandardFonts.Helvetica)
  const gray = rgb(0.45, 0.45, 0.45)
  const footerGray = rgb(0.61, 0.64, 0.69)
  const lineGray = rgb(0.83, 0.83, 0.83)

  const headerText = `No. Surat: ${publicId}`
  const line1 = `${printedAt} · E-HRIS | BANK GRESIK · Digenerate oleh ${generatedBy}`
  const line2 = "Dokumen ini dicetak menggunakan sistem HRIS Bank Gresik."

  for (const page of pages) {
    const { width, height } = page.getSize()
    const margin = 24

    const headerSize = 7
    page.drawText(headerText, {
      x: width - margin - font.widthOfTextAtSize(headerText, headerSize),
      y: height - margin,
      size: headerSize,
      font,
      color: gray,
    })

    const footerSize = 6
    const footerBaseY = 20
    page.drawLine({
      start: { x: margin, y: footerBaseY + 16 },
      end: { x: width - margin, y: footerBaseY + 16 },
      thickness: 0.5,
      color: lineGray,
    })
    page.drawText(line1, {
      x: (width - font.widthOfTextAtSize(line1, footerSize)) / 2,
      y: footerBaseY + 8,
      size: footerSize,
      font,
      color: footerGray,
    })
    page.drawText(line2, {
      x: (width - font.widthOfTextAtSize(line2, footerSize)) / 2,
      y: footerBaseY,
      size: footerSize,
      font,
      color: footerGray,
    })
  }
}

// Coba copy halaman PDF asli dari file lampiran langsung ke dokumen akhir,
// lalu ditempeli No. Surat + footer (lihat stampAttachmentPages). Return
// false kalau file tidak ada / bukan PDF valid, supaya pemanggil bisa
// fallback ke halaman keterangan alih-alih diam-diam kehilangan referensi
// lampirannya.
async function tryMergeAttachmentPdf(
  finalDoc: PDFDocument,
  url: string,
  stampInfo: { publicId: string; generatedBy: string; printedAt: string }
): Promise<boolean> {
  if (!url.startsWith("/")) return false
  const abs = path.join(process.cwd(), "public", url)
  try {
    const bytes = await readFile(abs)
    const attachmentPdf = await PDFDocument.load(bytes)
    const pages = await finalDoc.copyPages(attachmentPdf, attachmentPdf.getPageIndices())
    pages.forEach((p) => finalDoc.addPage(p))
    await stampAttachmentPages(finalDoc, pages, stampInfo)
    return true
  } catch {
    return false
  }
}

// Gabungkan surat + lampiran jadi SATU file PDF utuh — lampiran bergambar
// sudah inline di halaman surat (lihat AttachmentThumbnails di
// izin-print-pdf.tsx), sementara lampiran PDF asli (dokumen pendukung cuti
// >3 hari, surat dokter, dst) halaman-halamannya di-copy langsung persis
// setelah halaman surat terkait — bukan cuma ditautkan lewat teks.
export async function mergeIzinPrintPdf(
  entries: IzinPrintEntry[],
  generatedBy: string
): Promise<Uint8Array> {
  const finalDoc = await PDFDocument.create()
  const printedAt = formatPrintedAt(new Date())

  for (const entry of entries) {
    const letterBuffer = await renderToBuffer(
      <IzinPrintPdfDocument entries={[entry]} generatedBy={generatedBy} />
    )
    const letterPdf = await PDFDocument.load(letterBuffer)
    const letterPages = await finalDoc.copyPages(letterPdf, letterPdf.getPageIndices())
    letterPages.forEach((p) => finalDoc.addPage(p))

    const pdfAttachments = entry.doc.attachments.filter((a) => !isImageUrl(a.url))
    for (const attachment of pdfAttachments) {
      const merged = await tryMergeAttachmentPdf(finalDoc, attachment.url, {
        publicId: entry.doc.publicId,
        generatedBy,
        printedAt,
      })
      if (merged) continue

      // Fallback — file lampiran hilang/rusak/bukan PDF valid. Tetap kasih
      // halaman keterangan (sudah ada No. Surat + footer sendiri lewat
      // IzinAttachmentPage), jangan diam-diam kehilangan referensinya.
      const fallbackBuffer = await renderToBuffer(
        <Document>
          <IzinAttachmentPage
            publicId={entry.doc.publicId}
            label={attachment.label}
            applicantName={entry.doc.applicantName}
            url={attachment.url}
            generatedBy={generatedBy}
          />
        </Document>
      )
      const fallbackPdf = await PDFDocument.load(fallbackBuffer)
      const fallbackPages = await finalDoc.copyPages(fallbackPdf, fallbackPdf.getPageIndices())
      fallbackPages.forEach((p) => finalDoc.addPage(p))
    }
  }

  return finalDoc.save()
}
