import { readFile } from "fs/promises"
import path from "path"

import sharp, { type OverlayOptions } from "sharp"
import { PDFDocument, StandardFonts, degrees, rgb } from "pdf-lib"

import { prisma } from "@/lib/prisma"

// Watermark dokumen pribadi pegawai — DITEMPEL SAAT DIBUKA, bukan dibakar ke
// file saat diunggah. Alasannya:
//   1. File asli harus tetap utuh; KTP/KK/NPWP masih sering dibutuhkan apa
//      adanya untuk urusan resmi (BPJS, bank), dan cap permanen yang menutupi
//      NIK/foto tidak bisa dibatalkan.
//   2. Yang benar-benar menahan kebocoran adalah JEJAK, bukan logo: baris
//      "Dibuka oleh X · <waktu>" bikin tangkapan layar yang beredar bisa
//      dilacak ke orangnya. Itu cuma mungkin kalau dirender per permintaan,
//      karena identitas pembukanya baru diketahui saat itu.
//
// Konsekuensi yang diterima: ada biaya CPU tiap dokumen dibuka. Dianggap
// wajar karena ukurannya dibatasi 5MB (lihat lib/employee-document-storage.ts)
// dan dokumen identitas jarang diakses — bukan jalur panas.

export type WatermarkContext = {
  viewerName: string
  ownerName: string
  ownerNumber: string
}

const LOGO_PATH = path.join(process.cwd(), "public", "LogoSystem.png")

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

// Baris-baris yang dicetak. Urutannya sengaja: penanda kerahasiaan dulu
// (paling besar), lalu pemilik dokumen, lalu jejak pembukanya.
export async function buildWatermarkLines(ctx: WatermarkContext): Promise<{
  enabled: boolean
  headline: string
  details: string[]
}> {
  const settings = await prisma.employeeDocumentSettings.findUnique({ where: { id: 1 } })
  // Baris belum pernah dibuat = anggap menyala, sama seperti default kolomnya.
  const enabled = settings?.watermarkEnabled ?? true
  const extra = settings?.watermarkText?.trim()

  return {
    enabled,
    headline: "RAHASIA",
    details: [
      `Milik: ${ctx.ownerName} · ${ctx.ownerNumber}`,
      `Dibuka oleh ${ctx.viewerName} · ${formatStamp(new Date())}`,
      ...(extra ? [extra] : []),
    ],
  }
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

// Overlay SVG berukuran sama dengan gambarnya: pola teks miring berulang
// menutupi seluruh bidang, plus satu blok identitas di tengah. Dibuat sebagai
// SVG (bukan menggambar per-piksel) supaya tetap tajam di resolusi berapa pun.
function buildSvgOverlay(width: number, height: number, headline: string, details: string[]) {
  const headlineSize = Math.max(18, Math.round(width / 26))
  const detailSize = Math.max(11, Math.round(width / 55))
  const tileText = Math.max(12, Math.round(width / 40))

  // Jarak antar-ubin dibuat rapat & gridnya dimulai dari LUAR kanvas (indeks
  // negatif). Kalau dimulai dari 0, baris pertama tergambar dengan garis dasar
  // di y=0 sehingga jatuh di luar bidang dan sisi atas gambar jadi kosong —
  // celah kosong itu justru bagian yang paling gampang dipotong/disunting.
  const stepX = Math.max(150, Math.round(width / 3.2))
  const stepY = Math.max(90, Math.round(height / 5))
  const tiles: string[] = []
  for (let y = -stepY; y < height + stepY * 2; y += stepY) {
    // Baris ganjil digeser setengah langkah supaya polanya tidak membentuk
    // lorong lurus vertikal yang mudah dihindari saat memotong gambar.
    for (let x = -stepX; x < width + stepX; x += stepX) {
      const offset = (Math.round(y / stepY) % 2) * (stepX / 2)
      const px = x + offset
      tiles.push(
        `<text x="${px}" y="${y}" font-family="Helvetica, Arial, sans-serif" font-size="${tileText}" fill="rgba(0,0,0,0.18)" transform="rotate(-30 ${px} ${y})">${escapeXml(headline)}</text>`
      )
    }
  }

  const centerY = Math.round(height / 2)
  const detailLines = details
    .map(
      (line, i) =>
        `<text x="50%" y="${centerY + headlineSize + 6 + i * (detailSize + 6)}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="${detailSize}" fill="rgba(0,0,0,0.55)">${escapeXml(line)}</text>`
    )
    .join("")

  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      ${tiles.join("")}
      <text x="50%" y="${centerY}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif"
            font-size="${headlineSize}" font-weight="bold" fill="rgba(200,0,0,0.30)"
            transform="rotate(-30 ${width / 2} ${centerY})">${escapeXml(headline)}</text>
      ${detailLines}
    </svg>`
  )
}

export async function watermarkImage(
  input: Buffer,
  headline: string,
  details: string[]
): Promise<{ buffer: Buffer; contentType: string }> {
  const image = sharp(input, { failOn: "none" })
  const meta = await image.metadata()
  const width = meta.width ?? 1000
  const height = meta.height ?? 1400

  const composites: OverlayOptions[] = [
    { input: buildSvgOverlay(width, height, headline, details) },
  ]

  // Logo di pojok kanan-bawah — pelengkap penanda visual, bukan pengaman
  // utama. Kalau file logonya tidak ada, watermark teks tetap jalan.
  try {
    const logoSize = Math.max(48, Math.round(width / 8))
    const logo = await sharp(await readFile(LOGO_PATH))
      .resize(logoSize, logoSize, { fit: "inside" })
      .composite([{ input: Buffer.from([255, 255, 255, 140]), raw: { width: 1, height: 1, channels: 4 }, tile: true, blend: "dest-in" }])
      .png()
      .toBuffer()
    composites.push({ input: logo, gravity: "southeast" })
  } catch {
    // logo opsional — abaikan
  }

  // Selalu keluar sebagai PNG: hasil komposit dengan transparansi tidak cocok
  // dipaksa kembali ke JPEG, dan ukurannya tetap wajar untuk dokumen 5MB.
  const buffer = await image.composite(composites).png().toBuffer()
  return { buffer, contentType: "image/png" }
}

export async function watermarkPdf(
  input: Buffer,
  headline: string,
  details: string[]
): Promise<{ buffer: Buffer; contentType: string }> {
  const pdf = await PDFDocument.load(input, { ignoreEncryption: true })
  const font = await pdf.embedFont(StandardFonts.HelveticaBold)
  const detailFont = await pdf.embedFont(StandardFonts.Helvetica)

  for (const page of pdf.getPages()) {
    const { width, height } = page.getSize()
    const tile = Math.max(160, width / 3)

    for (let y = 0; y < height + tile; y += tile) {
      for (let x = -tile; x < width + tile; x += tile) {
        page.drawText(headline, {
          x,
          y,
          size: Math.max(10, width / 45),
          font: detailFont,
          color: rgb(0, 0, 0),
          opacity: 0.12,
          rotate: degrees(-30),
        })
      }
    }

    page.drawText(headline, {
      x: width / 6,
      y: height / 2,
      size: Math.max(24, width / 14),
      font,
      color: rgb(0.78, 0, 0),
      opacity: 0.25,
      rotate: degrees(-30),
    })

    details.forEach((line, i) => {
      const size = Math.max(8, width / 60)
      page.drawText(line, {
        x: 24,
        y: 24 + (details.length - 1 - i) * (size + 4),
        size,
        font: detailFont,
        color: rgb(0, 0, 0),
        opacity: 0.55,
      })
    })
  }

  return { buffer: Buffer.from(await pdf.save()), contentType: "application/pdf" }
}
