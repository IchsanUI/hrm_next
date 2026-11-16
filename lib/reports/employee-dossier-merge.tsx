import { readFile } from "fs/promises"
import path from "path"

import { renderToBuffer } from "@react-pdf/renderer"
import { PDFDocument, StandardFonts, degrees, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib"

import type { DossierAttachment, DossierData } from "@/lib/employee-dossier"
import { EmployeeDossierPdf, type DossierAttachmentIndexRow } from "@/lib/reports/employee-dossier-pdf"
import { signPdfLib } from "@/lib/app-signature"

// Menyatukan "Berkas Pegawai": halaman CV (react-pdf) + lampiran utuh
// (halaman PDF asli disalin apa adanya, gambar dipasang satu halaman penuh
// tanpa dipotong), lalu SEMUA halaman ditempeli watermark & jejak unduhan.

const A4 = { width: 595.28, height: 841.89 }

function formatStamp(date: Date) {
  return date.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  })
}

// Font standar PDF hanya mengenal WinAnsi — karakter di luar itu (mis. huruf
// non-Latin di nama) diganti "?" supaya stempel tidak membuat proses gagal.
function winAnsi(text: string) {
  return text.replace(/[^\x20-\x7E -ÿ–—…•]/g, "?")
}

// Potong teks satu baris agar muat (drawText maxWidth di pdf-lib justru
// membungkus ke baris baru, yang akan keluar dari area footer/label).
function fitText(text: string, font: PDFFont, size: number, maxWidth: number) {
  let value = winAnsi(text)
  if (font.widthOfTextAtSize(value, size) <= maxWidth) return value
  while (value.length > 1 && font.widthOfTextAtSize(`${value}…`, size) > maxWidth) value = value.slice(0, -1)
  return `${value.trimEnd()}…`
}

// Halaman lampiran bisa punya /Rotate (scan miring). Semua stempel digambar
// di "ruang tampilan" (apa yang dilihat pembaca), lalu dipetakan ke ruang
// halaman supaya teksnya tetap tegak dan di posisi yang benar.
function viewFrame(page: PDFPage) {
  const { width: W, height: H } = page.getSize()
  const rotation = ((page.getRotation().angle % 360) + 360) % 360
  const swap = rotation === 90 || rotation === 270
  const width = swap ? H : W
  const height = swap ? W : H
  const map = (vx: number, vy: number) => {
    switch (rotation) {
      case 90:
        return { x: W - vy, y: vx }
      case 180:
        return { x: W - vx, y: H - vy }
      case 270:
        return { x: vy, y: H - vx }
      default:
        return { x: vx, y: vy }
    }
  }
  return { width, height, rotation, map }
}

type StampContext = {
  font: PDFFont
  bold: PDFFont
  logo: PDFImage | null
  footerLeft: string
  totalPages: number
}

function stampPage(page: PDFPage, index: number, ctx: StampContext, label: string | null) {
  const { width, height, rotation, map } = viewFrame(page)
  const rotate = (extra = 0) => degrees(rotation + extra)
  const scale = Math.min(width, height) / A4.width

  // 1) Pola diagonal halus di seluruh bidang — penanda asal dokumen.
  const tileText = "HRIS BANK GRESIK"
  const tileSize = 11 * scale
  const stepX = 190 * scale
  const stepY = 120 * scale
  for (let vy = -stepY; vy < height + stepY; vy += stepY) {
    const shift = (Math.round(vy / stepY) % 2) * (stepX / 2)
    for (let vx = -stepX; vx < width + stepX; vx += stepX) {
      const p = map(vx + shift, vy)
      page.drawText(tileText, {
        ...p,
        size: tileSize,
        font: ctx.bold,
        color: rgb(0.09, 0.15, 0.33),
        opacity: 0.09,
        rotate: rotate(30),
      })
    }
  }

  // 2) Logo samar di tengah halaman.
  if (ctx.logo) {
    const size = Math.min(width, height) * 0.38
    const p = map((width - size) / 2, (height - size) / 2)
    page.drawImage(ctx.logo, { ...p, width: size, height: size, opacity: 0.05, rotate: rotate() })
  }

  // 3) Label lampiran di pojok kiri atas (hanya halaman pertama tiap lampiran).
  if (label) {
    const size = 7.5 * scale
    const padX = 6 * scale
    const text = fitText(label, ctx.bold, size, width - 24 * scale - padX * 2)
    const boxH = size + 7 * scale
    const boxW = ctx.bold.widthOfTextAtSize(text, size) + padX * 2
    const left = 12 * scale
    const top = height - 10 * scale
    page.drawRectangle({
      ...map(left, top - boxH),
      width: boxW,
      height: boxH,
      color: rgb(0.09, 0.15, 0.33),
      opacity: 0.9,
      rotate: rotate(),
    })
    page.drawText(text, {
      ...map(left + padX, top - boxH + 4 * scale),
      size,
      font: ctx.bold,
      color: rgb(1, 1, 1),
      rotate: rotate(),
    })
  }

  // 4) Footer jejak unduhan + nomor halaman, di atas pita putih tipis supaya
  //    tetap terbaca walau lampiran asli penuh sampai tepi bawah.
  const footSize = 6.5 * scale
  const footH = 16 * scale
  page.drawRectangle({ ...map(0, 0), width, height: footH, color: rgb(1, 1, 1), opacity: 0.7, rotate: rotate() })
  page.drawLine({
    start: map(12 * scale, footH),
    end: map(width - 12 * scale, footH),
    thickness: 0.4,
    color: rgb(0.8, 0.82, 0.86),
  })
  const right = `Hal. ${index + 1} / ${ctx.totalPages}`
  const rightWidth = ctx.font.widthOfTextAtSize(right, footSize)
  page.drawText(fitText(ctx.footerLeft, ctx.font, footSize, width - rightWidth - 36 * scale), {
    ...map(12 * scale, 5.5 * scale),
    size: footSize,
    font: ctx.font,
    color: rgb(0.4, 0.45, 0.52),
    rotate: rotate(),
  })
  page.drawText(right, {
    ...map(width - 12 * scale - rightWidth, 5.5 * scale),
    size: footSize,
    font: ctx.bold,
    color: rgb(0.4, 0.45, 0.52),
    rotate: rotate(),
  })
}

async function appendAttachment(doc: PDFDocument, attachment: DossierAttachment, font: PDFFont, bold: PDFFont) {
  if (attachment.kind === "pdf") {
    try {
      const source = await PDFDocument.load(attachment.bytes, { ignoreEncryption: true, updateMetadata: false })
      // PDF berpassword tetap "terbuka" dengan ignoreEncryption, tapi isinya
      // tersalin sebagai halaman rusak — lebih jujur diberi halaman keterangan.
      if (source.isEncrypted) throw new Error("encrypted")
      const pages = await doc.copyPages(source, source.getPageIndices())
      pages.forEach((p) => doc.addPage(p))
      return pages.length
    } catch {
      attachment = { title: attachment.title, kind: "missing", reason: "PDF terkunci atau rusak sehingga tidak bisa digabung.", pageCount: 1 }
    }
  }

  if (attachment.kind === "image") {
    // Orientasi halaman mengikuti gambar; gambar diskalakan agar MUAT utuh
    // di dalam margin (tidak pernah dipotong), lalu diletakkan di tengah.
    const landscape = attachment.width > attachment.height
    const pageSize: [number, number] = landscape ? [A4.height, A4.width] : [A4.width, A4.height]
    const page = doc.addPage(pageSize)
    const image = await doc.embedJpg(attachment.bytes)
    const margin = { x: 28, top: 40, bottom: 30 }
    const boxW = pageSize[0] - margin.x * 2
    const boxH = pageSize[1] - margin.top - margin.bottom
    const ratio = Math.min(boxW / attachment.width, boxH / attachment.height)
    const w = attachment.width * ratio
    const h = attachment.height * ratio
    page.drawImage(image, {
      x: (pageSize[0] - w) / 2,
      y: margin.bottom + (boxH - h) / 2,
      width: w,
      height: h,
    })
    return 1
  }

  const page = doc.addPage([A4.width, A4.height])
  page.drawText(fitText(attachment.title, bold, 13, A4.width - 96), { x: 48, y: A4.height / 2 + 16, size: 13, font: bold })
  page.drawText(attachment.reason, { x: 48, y: A4.height / 2 - 6, size: 10, font, color: rgb(0.45, 0.45, 0.45) })
  page.drawText("Silakan unduh file ini secara terpisah dari halaman detail pegawai.", {
    x: 48,
    y: A4.height / 2 - 22,
    size: 10,
    font,
    color: rgb(0.45, 0.45, 0.45),
  })
  return 1
}

export async function buildEmployeeDossierPdf({
  data,
  attachments,
  includeCv,
  downloadedBy,
}: {
  data: DossierData
  attachments: DossierAttachment[]
  includeCv: boolean
  downloadedBy: string
}): Promise<Uint8Array> {
  const now = new Date()
  const printedAt = formatStamp(now)
  const doc = await PDFDocument.create({ updateMetadata: false })

  // CV dirender dua kali bila ada lampiran: render pertama hanya untuk tahu
  // jumlah halaman CV, supaya Daftar Lampiran bisa mencantumkan halaman awal
  // tiap lampiran secara tepat.
  let cvPageCount = 0
  let cvBytes: Uint8Array | null = null
  if (includeCv) {
    const indexFor = (offset: number): DossierAttachmentIndexRow[] => {
      let cursor = offset + 1
      return attachments.map((a, i) => {
        const start = cursor
        cursor += a.pageCount
        return { no: i + 1, title: a.title, pages: a.pageCount > 1 ? `${start}–${start + a.pageCount - 1}` : String(start) }
      })
    }
    const render = async (offset: number) =>
      renderToBuffer(<EmployeeDossierPdf data={data} attachmentIndex={indexFor(offset)} printedAt={printedAt} />)

    let buffer = await render(0)
    cvPageCount = (await PDFDocument.load(buffer)).getPageCount()
    if (attachments.length > 0) buffer = await render(cvPageCount)
    cvBytes = buffer
  }

  if (cvBytes) {
    const cv = await PDFDocument.load(cvBytes)
    const pages = await doc.copyPages(cv, cv.getPageIndices())
    pages.forEach((p) => doc.addPage(p))
  }

  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)

  const labels = new Map<number, string>()
  for (const [i, attachment] of attachments.entries()) {
    const firstPage = doc.getPageCount()
    await appendAttachment(doc, attachment, font, bold)
    labels.set(firstPage, `Lampiran ${i + 1} · ${attachment.title}`)
  }

  let logo: PDFImage | null = null
  try {
    logo = await doc.embedPng(await readFile(path.join(process.cwd(), "public", "LogoSystem.png")))
  } catch {
    logo = null
  }

  const ctx: StampContext = {
    font,
    bold,
    logo,
    footerLeft: `Diunduh dari HRIS Bank Gresik oleh ${downloadedBy} · ${printedAt} WIB · Berkas ${data.fullName} (NIP ${data.employeeNumber}) · Dokumen rahasia, dilarang disebarluaskan`,
    totalPages: doc.getPageCount(),
  }
  doc.getPages().forEach((page, i) => stampPage(page, i, ctx, labels.get(i) ?? null))

  doc.setTitle(`Berkas Pegawai — ${data.fullName} (${data.employeeNumber})`)
  doc.setSubject("Berkas pegawai yang diunduh dari HRIS Bank Gresik")
  doc.setKeywords(["HRIS", "Bank Gresik", data.employeeNumber, `diunduh oleh ${downloadedBy}`])
  signPdfLib(doc)
  return doc.save()
}
