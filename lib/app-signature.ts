import type ExcelJS from "exceljs"

import { APP_VERSION } from "@/lib/app-version"

// Tanda tangan pembuat aplikasi. Sengaja TIDAK tampil di layar (teks copyright
// yang terlihat hanya "EDP/IT Bank Gresik"), tetapi tertanam di metadata:
// <meta name="author">, console browser, properti PDF, dan properti Excel.
export const APP_AUTHOR = "Mochammad Ichsan"
export const APP_ORGANIZATION = "EDP/IT Perumda BPR Bank Gresik"
export const APP_CREATOR = `HRIS Bank Gresik v${APP_VERSION} — dikembangkan oleh ${APP_AUTHOR}`

// Properti <Document> @react-pdf/renderer.
export const PDF_DOCUMENT_SIGNATURE = {
  author: APP_AUTHOR,
  creator: APP_CREATOR,
  producer: APP_CREATOR,
} as const

// Properti dokumen pdf-lib (untuk PDF hasil gabungan).
export function signPdfLib(pdf: {
  setAuthor(author: string): void
  setCreator(creator: string): void
  setProducer(producer: string): void
  setCreationDate(date: Date): void
  setModificationDate(date: Date): void
}) {
  const now = new Date()
  pdf.setCreationDate(now)
  pdf.setModificationDate(now)
  pdf.setAuthor(APP_AUTHOR)
  pdf.setCreator(APP_CREATOR)
  pdf.setProducer(APP_CREATOR)
}

// Properti workbook Excel (File → Info → Properties).
export function signWorkbook(workbook: ExcelJS.Workbook) {
  workbook.creator = APP_AUTHOR
  workbook.lastModifiedBy = APP_AUTHOR
  workbook.company = APP_ORGANIZATION
  workbook.manager = APP_CREATOR
}
