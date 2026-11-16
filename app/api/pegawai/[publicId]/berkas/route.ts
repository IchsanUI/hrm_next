import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { logActivity } from "@/lib/activity-log"
import { buildEmployeeDossier } from "@/lib/employee-dossier"
import {
  DOSSIER_ATTACHMENT_PARTS,
  DOSSIER_CV_PARTS,
  parseDossierParts,
} from "@/lib/employee-dossier-parts"
import { buildEmployeeDossierPdf } from "@/lib/reports/employee-dossier-merge"

// "Berkas Pegawai" — satu PDF berisi CV + lampiran pilihan (KTP, KK,
// sertifikat, file riwayat, dst), seluruh halaman diberi watermark & jejak
// pengunduh. Bagian yang disertakan dipilih lewat ?bagian=profil,ktp,...
// (lihat lib/employee-dossier-parts.ts).

// Render CV + gabung lampiran bisa memakan beberapa detik untuk pegawai
// dengan banyak file.
export const maxDuration = 120

function sanitizeFileNamePart(value: string) {
  return value.replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, " ").trim()
}

export async function GET(request: Request, { params }: { params: Promise<{ publicId: string }> }) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  // Sama dengan pengelola Data Pegawai — berkas ini memuat dokumen identitas.
  const allowed =
    session.user.role === "SUPER_ADMIN" ||
    (session.user.role === "HR_ADMIN" && session.user.menuAccess.includes("kepegawaian.pegawai"))
  if (!allowed) {
    return NextResponse.json({ error: "Anda tidak punya akses ke berkas pegawai." }, { status: 403 })
  }

  const { publicId } = await params
  const parts = parseDossierParts(new URL(request.url).searchParams.get("bagian"))
  if (parts.size === 0) {
    return NextResponse.json({ error: "Pilih minimal satu bagian untuk diunduh." }, { status: 400 })
  }

  const dossier = await buildEmployeeDossier(publicId, parts)
  if (!dossier) {
    return NextResponse.json({ error: "Data pegawai tidak ditemukan." }, { status: 404 })
  }

  const includeCv = DOSSIER_CV_PARTS.some((p) => parts.has(p.key))
  if (!includeCv && dossier.attachments.length === 0) {
    return NextResponse.json({ error: "Tidak ada file pada bagian yang dipilih." }, { status: 404 })
  }

  let bytes: Uint8Array
  try {
    bytes = await buildEmployeeDossierPdf({
      data: dossier.data,
      attachments: dossier.attachments,
      includeCv,
      downloadedBy: session.user.username,
    })
  } catch (err) {
    console.error(`Gagal membuat berkas pegawai ${publicId}:`, err)
    return NextResponse.json({ error: "Berkas gagal dibuat. Coba lagi atau hubungi administrator." }, { status: 500 })
  }

  const labels = [...DOSSIER_CV_PARTS, ...DOSSIER_ATTACHMENT_PARTS]
    .filter((p) => parts.has(p.key))
    .map((p) => p.label)
  await logActivity({
    userId: Number(session.user.id),
    username: session.user.username,
    action: "DOWNLOAD",
    entityType: "Employee",
    description: `${session.user.username} mengunduh berkas pegawai "${dossier.data.fullName}" (${dossier.data.employeeNumber}): ${labels.join(", ")}.`,
  })

  const name = sanitizeFileNamePart(`Berkas ${dossier.data.fullName} ${dossier.data.employeeNumber}`)
  const asciiName = name.replace(/[^\x20-\x7E]/g, "_")
  const disposition = new URL(request.url).searchParams.get("unduh") === "1" ? "attachment" : "inline"

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${disposition}; filename="${asciiName}.pdf"; filename*=UTF-8''${encodeURIComponent(name)}.pdf`,
      "Content-Length": String(bytes.length),
      // Watermark memuat nama pengunduh & waktu — jangan disimpan cache.
      "Cache-Control": "no-store, private",
    },
  })
}
