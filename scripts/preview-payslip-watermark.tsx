// Preview cepat watermark di PDF Slip Gaji, tanpa perlu data database.
// Jalankan: npx tsx scripts/preview-payslip-watermark.tsx
// Hasil: tmp/preview-payslip-watermark.pdf
import { mkdirSync, writeFileSync } from "fs"
import path from "path"

import QRCode from "qrcode"
import { renderToBuffer } from "@react-pdf/renderer"

import { PayslipPdfDocument } from "@/lib/reports/payslip-pdf"
import type { PayslipPrintDocument } from "@/lib/payroll/payslip-print"

const sample: PayslipPrintDocument = {
  payslipId: 1,
  slipNumber: "SLIP-202607-004857",
  employeeName: "MOCHAMMAD ICHSAN",
  employeeNumber: "2312030084",
  positionName: "EDP/IT",
  departmentName: "Personalia, Umum & IT",
  employmentStatusName: "Tetap",
  golongan: "C-1/1",
  paymentDateLabel: "25 Juli 2026",
  periodRangeLabel: "21 Juni 2026 s/d 20 Juli 2026",
  cityDateLabel: "Gresik, 25 Juli 2026",
  items: [
    { name: "Gaji Pokok", detail: null, category: "PENDAPATAN_TETAP", amount: 2579400 },
    { name: "Tunjangan Jabatan", detail: null, category: "PENDAPATAN_TETAP", amount: 1500000 },
    { name: "Tunjangan Pangan", detail: null, category: "PENDAPATAN_TETAP", amount: 250000 },
    { name: "BPJS Ketenagakerjaan (3%)", detail: null, category: "POTONGAN", amount: 5616 },
    { name: "PPh 21 (TER)", detail: null, category: "POTONGAN", amount: 46065 },
  ],
  grossPay: 6142031,
  totalDeduction: 123753,
  netPay: 6018278,
  leaveSummary: { cuti: 0, sakit: 0, dispensasiSppd: 0 },
  signerName: "RETNO WULANDARI",
  signerTitle: "Kabag Personalia, Umum & IT",
  signatureUrl: null,
  letterheadUrl: null,
  watermarkText: "RAHASIA",
}

async function main() {
  const qrCodeDataUrl = await QRCode.toDataURL(sample.slipNumber, { margin: 0, width: 160 })
  const buffer = await renderToBuffer(
    <PayslipPdfDocument doc={sample} generatedBy="preview-script" qrCodeDataUrl={qrCodeDataUrl} />
  )
  const outDir = path.join(process.cwd(), "tmp")
  mkdirSync(outDir, { recursive: true })
  const outPath = path.join(outDir, "preview-payslip-watermark.pdf")
  writeFileSync(outPath, buffer)
  console.log(`OK -> ${outPath}`)
}

main()
