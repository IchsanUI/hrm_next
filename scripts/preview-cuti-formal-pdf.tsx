// Preview cepat layout "Surat Permohonan Cuti" (CutiFormalPrintPage) TANPA
// perlu jalanin app / punya data di database — render ke file PDF pakai data
// contoh, buat ngecek tata letak paragraf, spasi baris, & kotak
// catatan/pertimbangan.
//
// Jalankan: npx tsx scripts/preview-cuti-formal-pdf.tsx
// Hasil: tmp/preview-cuti-formal.pdf

import { mkdirSync, writeFileSync } from "fs"
import path from "path"

import { Document, renderToBuffer } from "@react-pdf/renderer"

import { CutiFormalPrintPage } from "@/lib/reports/izin-print-pdf"
import type { CutiFormalPrintDocument } from "@/lib/izin-print"

const sample: CutiFormalPrintDocument = {
  publicId: "CT000011784888198481Q8LVQH",
  kind: "cuti",
  applicantName: "MOCHAMMAD ICHSAN",
  applicantNumber: "2312030084",
  applicantPosition: "EDP/IT",
  submissionDateLabel: "24 Juli 2026",
  leaveTypeLabel: "Cuti Tahunan",
  durationLabel: "4 (empat) hari kerja",
  startDateLabel: "24 Jul 2026",
  endDateLabel: "27 Jul 2026",
  applicantAddress:
    "Jl. Raya Brantas 51A Kelurahan Randuagung Kecamatan Kebomas Gresik Jawa Timur",
  applicantPhone: "87882411533",
  attachmentNote:
    "Demikian permohonan ini kami buat dan berikut kami lampirkan dokumen pendukung untuk dapat dijadikan bahan pertimbangan.",
  cityDateLabel: "Gresik, 24 Juli 2026",
  signerName: "RETNO WULANDARI, SE",
  signerSignatureUrl: null,
  substitute: {
    name: "FARIDA ASTRA RENATA",
    note: "Siap membantu menangani tiket IT selama pemohon cuti.",
    status: "APPROVED",
    actedAt: "26 Jul 2026, 14.02",
    signatureUrl: "/uploads/ttd/207-1785060956963.png",
  },
  leaveConsumption: {
    cutiTahunanHari: 4,
    cutiBesarHari: 0,
    cutiSakitHari: 2,
    cutiMelahirkanHari: 0,
  },
  considerationColumns: [
    {
      label: "Catatan/Pertimbangan Kepala Departemen",
      note: "Pekerjaan sudah dilimpahkan ke pegawai pengganti, tidak ada agenda kritikal di rentang tanggal tersebut.",
      status: "APPROVED",
      signerName: "RETNO WULANDARI",
      signatureUrl: "/uploads/ttd/179-1784682754540.png",
      actedAt: "26 Jul 2026, 15.30",
    },
    {
      label: "Catatan/Pertimbangan Kabag. Personalia & Umum",
      note: null,
      status: "APPROVED",
      signerName: "RETNO WULANDARI",
      signatureUrl: "/uploads/ttd/204-1784880315520.png",
      actedAt: "26 Jul 2026, 16.41",
    },
    {
      label: "Keputusan Direksi",
      note: "Disetujui.",
      status: "APPROVED",
      signerName: "EDY HADISISWOYO",
      signatureUrl: "/uploads/ttd/205-1785060941254.png",
      actedAt: "26 Jul 2026, 16.43",
    },
  ],
  attachments: [
    {
      label: "Foto Pendukung",
      url: "/uploads/absen-luar-kantor-bukti/192-1784697204755-CV_2026_2.png",
    },
  ],
  letterheadUrl: "/uploads/payroll/kop-surat-1785068594119.png",
}

async function main() {
  const buffer = await renderToBuffer(
    <Document>
      <CutiFormalPrintPage doc={sample} generatedBy="preview-script" />
    </Document>
  )
  const outDir = path.join(process.cwd(), "tmp")
  mkdirSync(outDir, { recursive: true })
  const outPath = path.join(outDir, "preview-cuti-formal.pdf")
  writeFileSync(outPath, buffer)
  console.log(`OK -> ${outPath}`)
}

main()
