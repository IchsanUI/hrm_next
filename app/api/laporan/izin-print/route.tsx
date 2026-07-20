import { NextResponse } from "next/server"
import JSZip from "jszip"

import { auth } from "@/auth"
import { logActivity } from "@/lib/activity-log"
import {
  getIzinPrintDocuments,
  getOvertimePrintDocuments,
  parseIzinPrintSelections,
} from "@/lib/izin-print"
import { IZIN_MONITORING_KIND_OPTIONS } from "@/lib/izin-monitoring-constants"
import type { IzinPrintEntry } from "@/lib/reports/izin-print-pdf"
import { mergeIzinPrintPdf } from "@/lib/reports/izin-print-merge"

const KIND_LABEL = new Map(IZIN_MONITORING_KIND_OPTIONS.map((o) => [o.value, o.label]))

// Karakter yang tidak boleh ada di nama file Windows/macOS/Linux.
function sanitizeFileNamePart(value: string) {
  return value.replace(/[\\/:*?"<>|]/g, "").trim()
}

function jenisLabelOf(entry: IzinPrintEntry) {
  return entry.type === "overtime" ? "Izin Lembur" : (KIND_LABEL.get(entry.doc.kind) ?? "Izin")
}

// Format: JenisIzin_NamaPegawai_NomorSurat.pdf — nomor surat pakai publicId
// (referensi unik yang sama dipakai di URL detail/riwayat izin).
function fileNameOf(entry: IzinPrintEntry) {
  const parts = [jenisLabelOf(entry), entry.doc.applicantName, entry.doc.publicId]
  return `${parts.map(sanitizeFileNamePart).join("_")}.pdf`
}

function todayFileDate() {
  const now = new Date()
  const day = String(now.getDate()).padStart(2, "0")
  const month = now.toLocaleDateString("id-ID", { month: "short" })
  return `${day}-${month}-${now.getFullYear()}`
}

export async function GET(request: Request) {
  const session = await auth()
  const role = session?.user.role
  const isAdminRole = role === "SUPER_ADMIN" || role === "HR_ADMIN"
  if (!session?.user || !isAdminRole) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const url = new URL(request.url)
  const selections = parseIzinPrintSelections(url.searchParams.get("items") ?? undefined)
  if (selections.length === 0) {
    return NextResponse.json({ error: "Tidak ada pengajuan yang dipilih." }, { status: 400 })
  }

  // Lembur ("Surat Perintah Lembur") pakai format cetak & fetch sendiri —
  // lihat lib/izin-print.ts. Hasil kedua fetch digabung lagi mengikuti
  // urutan `selections` asli (urutan baris yang dicentang user).
  const overtimePublicIds = selections.filter((s) => s.kind === "lembur").map((s) => s.publicId)
  const otherSelections = selections.filter((s) => s.kind !== "lembur")

  const [overtimeDocuments, genericDocuments] = await Promise.all([
    getOvertimePrintDocuments(overtimePublicIds),
    getIzinPrintDocuments(otherSelections),
  ])
  const overtimeByPublicId = new Map(overtimeDocuments.map((d) => [d.publicId, d]))
  const genericByPublicId = new Map(genericDocuments.map((d) => [d.publicId, d]))

  const entries: IzinPrintEntry[] = selections.flatMap((s): IzinPrintEntry[] => {
    if (s.kind === "lembur") {
      const doc = overtimeByPublicId.get(s.publicId)
      return doc ? [{ type: "overtime", doc }] : []
    }
    const doc = genericByPublicId.get(s.publicId)
    return doc ? [{ type: "generic", doc }] : []
  })

  if (entries.length === 0) {
    return NextResponse.json({ error: "Pengajuan yang dipilih tidak ditemukan." }, { status: 404 })
  }

  await logActivity({
    userId: Number(session.user.id),
    username: session.user.username,
    action: "DOWNLOAD",
    entityType: "Report",
    description: `${session.user.username} mengunduh PDF Surat Izin (${entries.length} pengajuan).`,
  })

  // Satu pengajuan → langsung unduh PDF-nya. Lebih dari satu → PDF per
  // pengajuan (bukan satu PDF gabungan multi-halaman), dibungkus jadi satu
  // file .zip. Lampiran PDF asli (dokumen pendukung, surat dokter, dst)
  // halamannya digabung langsung ke file yang sama lewat mergeIzinPrintPdf
  // — bukan cuma ditautkan.
  if (entries.length === 1) {
    const buffer = await mergeIzinPrintPdf(entries, session.user.username)
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileNameOf(entries[0])}"`,
      },
    })
  }

  const zip = new JSZip()
  await Promise.all(
    entries.map(async (entry) => {
      const buffer = await mergeIzinPrintPdf([entry], session.user.username)
      zip.file(fileNameOf(entry), buffer)
    })
  )
  const zipBuffer = await zip.generateAsync({ type: "nodebuffer" })

  return new NextResponse(new Uint8Array(zipBuffer), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="Eksport Izin Pegawai_${todayFileDate()}.zip"`,
    },
  })
}
