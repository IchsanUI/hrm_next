import { readFile } from "fs/promises"
import path from "path"

import sharp from "sharp"

import { prisma } from "@/lib/prisma"
import { resolveEmployeeDocumentPath } from "@/lib/employee-document-storage"
import { resolveCertificateFile } from "@/lib/certificate-storage"
import { getEmployeeCertificationSummary } from "@/lib/certification-compliance"
import type { DossierAttachmentPart, DossierPart } from "@/lib/employee-dossier-parts"

// Pengumpul data "Berkas Pegawai" — CV + daftar lampiran (dokumen pribadi,
// scan sertifikat, file pendukung riwayat). Dipakai route
// app/api/pegawai/[publicId]/berkas/route.tsx dan halaman detail pegawai
// (untuk menghitung jumlah file per bagian di dialog unduh).

const GENDER_LABEL: Record<string, string> = { MALE: "Laki-laki", FEMALE: "Perempuan" }
const MARITAL_LABEL: Record<string, string> = {
  SINGLE: "Belum Menikah",
  MARRIED: "Menikah",
  DIVORCED: "Cerai",
  WIDOWED: "Janda/Duda",
}
const WORK_SHIFT_TYPE_LABEL: Record<string, string> = { PEGAWAI: "Jam Pegawai", OUTSOURCING: "Jam Outsourcing" }

// Kolom @db.Date tersimpan sebagai tengah malam UTC — format di UTC supaya
// tanggalnya tidak bergeser.
export function formatDossierDate(date: Date | null | undefined) {
  if (!date) return "-"
  return date.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" })
}

function formatIsoDate(iso: string | null) {
  return iso ? formatDossierDate(new Date(`${iso}T00:00:00Z`)) : "Selamanya"
}

function shorten(text: string | null | undefined, max = 70) {
  const value = (text ?? "").replace(/\s+/g, " ").trim()
  return value.length > max ? `${value.slice(0, max - 1)}…` : value
}

async function loadEmployee(publicId: string) {
  return prisma.employee.findUnique({
    where: { publicId },
    include: {
      department: true,
      position: true,
      workLocation: true,
      employmentStatus: true,
      workShift: true,
      salaryGrade: true,
      reportsTo: { select: { fullName: true, position: { select: { name: true } } } },
      spouse: true,
      children: { orderBy: { birthDate: "asc" } },
      workHistories: { orderBy: { date: "desc" } },
      trainings: { orderBy: { date: "desc" } },
      achievements: { orderBy: { date: "desc" } },
      rewardsPunishments: { orderBy: { date: "desc" } },
      mutations: { orderBy: { date: "desc" } },
      assignmentLetters: { orderBy: { date: "desc" } },
      certifications: {
        include: { certificationType: { select: { name: true } } },
        orderBy: { issuedDate: "desc" },
      },
    },
  })
}

type LoadedEmployee = NonNullable<Awaited<ReturnType<typeof loadEmployee>>>

// File pendukung riwayat disimpan di public/uploads/** (lihat
// server/actions/employee-history.ts). Hanya path di dalam folder itu yang
// diterima — nilai fileUrl aneh tidak bisa dipakai membaca file lain.
const PUBLIC_UPLOADS_DIR = path.join(process.cwd(), "public", "uploads")
function resolvePublicUpload(url: string | null | undefined): string | null {
  if (!url || !url.startsWith("/uploads/")) return null
  const abs = path.resolve(process.cwd(), "public", `.${url}`)
  return abs.startsWith(PUBLIC_UPLOADS_DIR + path.sep) ? abs : null
}

type AttachmentSource = { part: DossierAttachmentPart; title: string; filePath: string | null }

function collectAttachmentSources(employee: LoadedEmployee): AttachmentSource[] {
  const sources: AttachmentSource[] = [
    { part: "ktp", title: "KTP", filePath: resolveEmployeeDocumentPath(employee.ktpFilePath) },
    { part: "kk", title: "Kartu Keluarga", filePath: resolveEmployeeDocumentPath(employee.kkFilePath) },
    { part: "npwp", title: "NPWP", filePath: resolveEmployeeDocumentPath(employee.npwpFilePath) },
    {
      part: "marital",
      title: employee.maritalStatus === "DIVORCED" ? "Akta Cerai" : "Surat Nikah",
      filePath: resolveEmployeeDocumentPath(employee.maritalDocumentFilePath),
    },
  ].filter((s) => s.filePath) as AttachmentSource[]

  for (const child of employee.children) {
    if (!child.birthCertFilePath) continue
    sources.push({
      part: "akta",
      title: `Akta Kelahiran — ${child.fullName}`,
      filePath: resolveEmployeeDocumentPath(child.birthCertFilePath),
    })
  }
  for (const cert of employee.certifications) {
    if (!cert.storedFileName) continue
    sources.push({
      part: "file-sertifikat",
      title: `Sertifikat — ${cert.certificationType.name}${cert.certificateNumber ? ` (${cert.certificateNumber})` : ""}`,
      filePath: resolveCertificateFile(cert.storedFileName),
    })
  }
  const history: [DossierAttachmentPart, string, { date: Date; description: string | null; fileUrl: string | null }[]][] = [
    ["file-pelatihan", "Pelatihan", employee.trainings],
    ["file-prestasi", "Prestasi", employee.achievements],
    ["file-mutasi", "Mutasi", employee.mutations],
    ["file-surat-tugas", "Surat Tugas", employee.assignmentLetters],
  ]
  for (const [part, label, rows] of history) {
    for (const row of rows) {
      if (!row.fileUrl) continue
      const desc = shorten(row.description, 60)
      sources.push({
        part,
        title: `${label} — ${formatDossierDate(row.date)}${desc ? ` · ${desc}` : ""}`,
        filePath: resolvePublicUpload(row.fileUrl),
      })
    }
  }
  return sources
}

// Jumlah file per bagian lampiran — untuk dialog pilihan unduh (bagian
// tanpa file ditampilkan nonaktif).
export async function getDossierAttachmentCounts(publicId: string) {
  const counts: Partial<Record<DossierAttachmentPart, number>> = {}
  const employee = await loadEmployee(publicId)
  if (!employee) return counts
  for (const source of collectAttachmentSources(employee)) {
    counts[source.part] = (counts[source.part] ?? 0) + 1
  }
  return counts
}

export type DossierAttachment =
  | { title: string; kind: "pdf"; bytes: Buffer; pageCount: number }
  | { title: string; kind: "image"; bytes: Buffer; width: number; height: number; pageCount: 1 }
  | { title: string; kind: "missing"; reason: string; pageCount: 1 }

async function loadAttachment(source: AttachmentSource): Promise<DossierAttachment> {
  if (!source.filePath) {
    return { title: source.title, kind: "missing", reason: "File tidak ditemukan di server.", pageCount: 1 }
  }
  try {
    const bytes = await readFile(source.filePath)
    if (bytes.subarray(0, 5).toString("latin1") === "%PDF-") {
      // Jumlah halaman dihitung di sini supaya Daftar Lampiran di CV bisa
      // mencantumkan nomor halaman; validitas penuhnya dicek lagi saat digabung.
      const { PDFDocument } = await import("pdf-lib")
      const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false })
      return { title: source.title, kind: "pdf", bytes, pageCount: pdf.getPageCount() }
    }
    // Gambar dinormalkan: orientasi EXIF diterapkan (foto KTP dari HP sering
    // miring), transparansi diberi latar putih, keluar sebagai JPEG.
    const { data, info } = await sharp(bytes, { failOn: "none" })
      .rotate()
      // Batasi ~300 dpi untuk A4 supaya foto HP 12MP tidak membengkakkan PDF.
      .resize({ width: 2480, height: 2480, fit: "inside", withoutEnlargement: true })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 88 })
      .toBuffer({ resolveWithObject: true })
    return { title: source.title, kind: "image", bytes: data, width: info.width, height: info.height, pageCount: 1 }
  } catch {
    return { title: source.title, kind: "missing", reason: "File rusak atau formatnya tidak didukung.", pageCount: 1 }
  }
}

async function loadPublicImage(url: string | null): Promise<Buffer | null> {
  const abs = resolvePublicUpload(url)
  if (!abs) return null
  try {
    return await sharp(await readFile(abs), { failOn: "none" }).rotate().png().toBuffer()
  } catch {
    return null
  }
}

export type DossierTable = { head: string[]; widths: number[]; rows: string[][]; empty: string }
export type DossierSection =
  | { kind: "fields"; title: string; fields: [string, string][] }
  | { kind: "table"; title: string; table: DossierTable }
  | { kind: "family"; title: string; spouse: [string, string][] | null; children: DossierTable }
  | { kind: "certifications"; title: string; requirements: DossierTable | null; certificates: DossierTable }

export type DossierData = {
  fullName: string
  employeeNumber: string
  position: string
  department: string
  employmentStatus: string
  isActive: boolean
  photo: Buffer | null
  signature: Buffer | null
  initials: Buffer | null
  sections: DossierSection[]
}

const COMPLIANCE_LABEL: Record<string, string> = {
  TERPENUHI: "Terpenuhi",
  SEGERA: "Segera kedaluwarsa",
  KEDALUWARSA: "Kedaluwarsa",
  BELUM_ADA: "Belum ada",
}
const CERT_STATUS_LABEL: Record<string, string> = {
  AKTIF: "Aktif",
  SEGERA: "Segera kedaluwarsa",
  KEDALUWARSA: "Kedaluwarsa",
}

async function buildSections(employee: LoadedEmployee, parts: Set<DossierPart>): Promise<DossierSection[]> {
  const sections: DossierSection[] = []
  const d = formatDossierDate

  if (parts.has("profil")) {
    const shift = employee.workShift
    sections.push({
      kind: "fields",
      title: "Informasi Kepegawaian",
      fields: [
        ["NIP", employee.employeeNumber],
        ["Jabatan", employee.position.name],
        ["Bagian", employee.department.name],
        ["Status Pekerjaan", employee.employmentStatus.name],
        ["Mulai Kerja", d(employee.startDate)],
        ["Lokasi Kerja", employee.workLocation.name],
        [
          "Jam Kerja",
          shift
            ? `${shift.name} (${WORK_SHIFT_TYPE_LABEL[shift.type]}, ${shift.checkInTime.toISOString().slice(11, 16)}-${shift.checkOutTime.toISOString().slice(11, 16)})`
            : "-",
        ],
        ["Melapor Kepada", employee.reportsTo ? `${employee.reportsTo.fullName} — ${employee.reportsTo.position.name}` : "-"],
        [
          "Golongan",
          employee.salaryGrade
            ? `${employee.salaryGrade.code}-${employee.salaryGrade.subGrade}${employee.salaryGradeStep !== null ? `/${employee.salaryGradeStep}` : ""}`
            : "-",
        ],
        ["Status", employee.isActive ? "Aktif" : "Nonaktif"],
      ],
    })
    sections.push({
      kind: "fields",
      title: "Data Pribadi",
      fields: [
        ["Jenis Kelamin", GENDER_LABEL[employee.gender] ?? "-"],
        ["Tempat, Tgl Lahir", `${employee.birthPlace}, ${d(employee.birthDate)}`],
        ["Status Diri", employee.maritalStatus ? MARITAL_LABEL[employee.maritalStatus] : "-"],
        ["NIK", employee.nik],
        ["NPWP", employee.npwp || "-"],
        ["Status PTKP", employee.ptkpStatus ?? "-"],
        ["Pendidikan Terakhir", employee.lastEducation || "-"],
        ["Jurusan", employee.major || "-"],
        ["Gelar", employee.degree || "-"],
        ["Nama Ayah", employee.fatherName || "-"],
        ["Nama Ibu", employee.motherName || "-"],
        ["Penyakit Bawaan", employee.illness || "-"],
        ["Hobi", employee.hobby || "-"],
        ["Usaha Sampingan", employee.sideBusiness || "-"],
      ],
    })
    sections.push({
      kind: "fields",
      title: "Alamat & Kontak",
      fields: [
        ["Alamat Domisili", employee.address],
        ["Alamat KTP", employee.ktpAddress || "-"],
        ["No HP", employee.phone],
        ["No HP Urgent", employee.emergencyPhone || "-"],
        ["Email", employee.email],
        ["Instagram", employee.instagram || "-"],
        ["Facebook", employee.facebook || "-"],
        ["Tiktok", employee.tiktok || "-"],
      ],
    })
  }

  if (parts.has("keluarga")) {
    const spouse = employee.spouse
    sections.push({
      kind: "family",
      title: "Data Keluarga",
      spouse: spouse
        ? [
            ["Nama Suami/Istri", spouse.fullName],
            ["Pekerjaan", spouse.occupation || "-"],
            ["Tempat, Tgl Lahir", `${spouse.birthPlace || "-"}${spouse.birthDate ? `, ${d(spouse.birthDate)}` : ""}`],
          ]
        : null,
      children: {
        head: ["No", "Nama Anak", "Tempat Lahir", "Tanggal Lahir"],
        widths: [8, 46, 26, 20],
        rows: employee.children.map((c, i) => [String(i + 1), c.fullName, c.birthPlace || "-", d(c.birthDate)]),
        empty: "Belum ada data anak.",
      },
    })
  }

  if (parts.has("sertifikasi")) {
    const summary = await getEmployeeCertificationSummary(employee.id)
    sections.push({
      kind: "certifications",
      title: "Sertifikasi & Pelatihan Wajib",
      requirements:
        summary && summary.requirements.length > 0
          ? {
              head: ["Kewajiban", "Berlaku s.d.", "Status"],
              widths: [56, 22, 22],
              rows: summary.requirements.map((r) => [
                r.typeName,
                r.status === "BELUM_ADA" ? "-" : formatIsoDate(r.expiryDate),
                COMPLIANCE_LABEL[r.status],
              ]),
              empty: "",
            }
          : null,
      certificates: {
        head: ["Sertifikat", "Nomor / Penyelenggara", "Terbit", "Berlaku s.d.", "Status"],
        widths: [30, 26, 14, 14, 16],
        rows: (summary?.certificates ?? []).map((c) => [
          c.typeName,
          [c.certificateNumber, c.issuer].filter(Boolean).join(" · ") || "-",
          formatIsoDate(c.issuedDate),
          formatIsoDate(c.expiryDate),
          CERT_STATUS_LABEL[c.status],
        ]),
        empty: "Belum ada sertifikat yang dicatat.",
      },
    })
  }

  const dateDesc = (title: string, part: DossierPart, rows: { date: Date; description: string }[], empty: string) => {
    if (!parts.has(part)) return
    sections.push({
      kind: "table",
      title,
      table: {
        head: ["No", "Tanggal", "Uraian"],
        widths: [8, 18, 74],
        rows: rows.map((r, i) => [String(i + 1), d(r.date), r.description]),
        empty,
      },
    })
  }

  dateDesc("Riwayat Pekerjaan", "pekerjaan", employee.workHistories, "Belum ada riwayat pekerjaan.")
  dateDesc("Riwayat Pendidikan & Pelatihan", "pelatihan", employee.trainings, "Belum ada riwayat pelatihan.")
  dateDesc("Prestasi", "prestasi", employee.achievements, "Belum ada data prestasi.")
  dateDesc(
    "Daftar Reward",
    "reward",
    employee.rewardsPunishments.filter((r) => r.type === "REWARD"),
    "Belum ada data reward."
  )
  dateDesc(
    "Daftar Punishment",
    "punishment",
    employee.rewardsPunishments.filter((r) => r.type === "PUNISHMENT"),
    "Belum ada data punishment."
  )

  if (parts.has("mutasi")) {
    sections.push({
      kind: "table",
      title: "Mutasi",
      table: {
        head: ["No", "Tanggal", "Jabatan Lama", "Jabatan Baru", "Uraian"],
        widths: [8, 16, 22, 22, 32],
        rows: employee.mutations.map((m, i) => [
          String(i + 1),
          d(m.date),
          m.oldPosition || "-",
          m.newPosition || "-",
          m.description || "-",
        ]),
        empty: "Belum ada data mutasi.",
      },
    })
  }
  dateDesc("Surat Tugas", "surat-tugas", employee.assignmentLetters, "Belum ada surat tugas.")

  return sections
}

export async function buildEmployeeDossier(publicId: string, parts: Set<DossierPart>) {
  const employee = await loadEmployee(publicId)
  if (!employee) return null

  const sources = collectAttachmentSources(employee).filter((s) => parts.has(s.part))
  const [attachments, sections, photo, signature, initials] = await Promise.all([
    Promise.all(sources.map(loadAttachment)),
    buildSections(employee, parts),
    loadPublicImage(employee.photoUrl),
    loadPublicImage(employee.signatureUrl),
    loadPublicImage(employee.initialsUrl),
  ])

  const data: DossierData = {
    fullName: employee.fullName,
    employeeNumber: employee.employeeNumber,
    position: employee.position.name,
    department: employee.department.name,
    employmentStatus: employee.employmentStatus.name,
    isActive: employee.isActive,
    photo,
    signature,
    initials,
    sections,
  }

  return { employeeId: employee.id, data, attachments }
}
