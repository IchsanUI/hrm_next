import path from "path"
import { readFileSync } from "fs"

import { Document, Page, View, Text, Image, Link, StyleSheet } from "@react-pdf/renderer"

import type { IzinPrintDocument, OvertimePrintDocument, ApprovalColumnPrint } from "@/lib/izin-print"

const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".gif"]

function isImageUrl(url: string) {
  const lower = url.toLowerCase()
  return IMAGE_EXTENSIONS.some((ext) => lower.endsWith(ext))
}

const FLOW_STATUS_LABEL: Record<ApprovalColumnPrint["status"], string> = {
  WAITING: "Menunggu",
  IN_PROGRESS: "Diproses",
  APPROVED: "Disetujui",
  REJECTED: "Ditolak",
  REVISED: "Revisi",
  SKIPPED: "Dilewati",
}

// Ringkasan waktu approve & alur approval — ditambahkan sebagai catatan di
// surat cetak. Kolom Pemohon dikeluarkan (bukan bagian alur approval,
// cuma tanda tangan pengaju).
function approvalFlowNotes(columns: ApprovalColumnPrint[]): string[] {
  return columns
    .filter((c) => c.label !== "Pemohon" && c.label !== "Dibuat")
    .map((c) => {
      const statusLabel = FLOW_STATUS_LABEL[c.status]
      const who = c.signerName ? ` oleh ${c.signerName}` : ""
      const when = c.actedAt ? ` — ${c.actedAt}` : ""
      return `${c.label}: ${statusLabel}${who}${when}`
    })
}

// URL upload disimpan sebagai path relatif ("/uploads/...") — react-pdf
// jalan di Node (bukan browser), jadi gambar diambil langsung dari disk
// (public/**) alih-alih lewat HTTP. Sengaja dibaca jadi Buffer (bukan
// dioper sebagai path string ke prop `src`) — react-pdf mem-parsing path
// pakai `url.parse()`, yang salah mengira drive letter Windows (mis. "D:")
// sebagai protocol URL, bikin file lokal gagal dimuat (coba fetch ke
// jaringan alih-alih baca disk). Buffer melewati masalah itu sepenuhnya.
function localImageBuffer(url: string): Buffer | null {
  if (!url.startsWith("/")) return null
  const abs = path.join(process.cwd(), "public", url)
  try {
    return readFileSync(abs)
  } catch {
    return null
  }
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

const styles = StyleSheet.create({
  page: { padding: 32, paddingBottom: 60, fontSize: 9, fontFamily: "Helvetica", color: "#111111" },
  docNumberRow: { alignItems: "flex-end", marginBottom: 8 },
  docNumberText: { fontSize: 8, color: "#737373" },
  perihal: { marginTop: 4, marginBottom: 6 },
  bold: { fontWeight: 700 },
  table: { borderWidth: 1, borderColor: "#d4d4d4" },
  tr: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#d4d4d4" },
  trLast: { flexDirection: "row" },
  tdLabel: { width: 110, padding: 5, fontWeight: 700, borderRightWidth: 1, borderRightColor: "#d4d4d4" },
  tdColon: { width: 14, padding: 5, textAlign: "center", borderRightWidth: 1, borderRightColor: "#d4d4d4" },
  tdValue: { flex: 1, padding: 5 },
  cityDate: { marginTop: 12, marginBottom: 6 },
  approvalHead: {
    flex: 1,
    padding: 5,
    backgroundColor: "#fafafa",
    borderRightWidth: 1,
    borderRightColor: "#d4d4d4",
  },
  approvalHeadText: { fontSize: 8, fontWeight: 700, textAlign: "center" },
  approvalBody: {
    flex: 1,
    height: 60,
    alignItems: "center",
    justifyContent: "center",
    borderRightWidth: 1,
    borderRightColor: "#d4d4d4",
  },
  approvalName: {
    flex: 1,
    padding: 4,
    fontSize: 7,
    textAlign: "center",
    borderRightWidth: 1,
    borderRightColor: "#d4d4d4",
  },
  signatureImage: { width: 70, height: 40, objectFit: "contain" },
  processText: { fontSize: 7.5, color: "#737373" },
  rejectedText: { fontSize: 7.5, color: "#dc2626", fontWeight: 700 },
  notesBox: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#d4d4d4",
    borderRadius: 2,
    padding: 6,
    fontSize: 8,
    color: "#737373",
  },
  notesBoxLine: { marginTop: 3 },
  warningBox: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#fca5a5",
    backgroundColor: "#fef2f2",
    borderRadius: 2,
    padding: 8,
    fontSize: 8,
    color: "#b91c1c",
    textAlign: "center",
  },
  attachmentLabel: { fontSize: 8, color: "#737373", marginBottom: 2 },
  attachmentTitle: { fontSize: 10, fontWeight: 700, marginBottom: 10 },
  attachmentImage: { width: "100%", maxHeight: 650, objectFit: "contain" },
  attachmentLink: { fontSize: 9, color: "#2563eb" },
  // Foto pendukung (mis. Bukti Lembur) digabung langsung di bagian bawah
  // halaman surat, bukan di halaman terpisah — cuma lampiran bergambar yang
  // bisa ditampilkan begini, dokumen PDF tetap dapat halaman sendiri
  // (lihat IzinAttachmentPage). Sengaja TANPA frame/border dan TANPA crop
  // (objectFit "contain", bukan "cover") — rasio asli foto dipertahankan,
  // cuma dibatasi maxWidth/maxHeight supaya tetap muat 1 halaman walau
  // fotonya banyak.
  attachmentSectionTitle: { marginTop: 12, marginBottom: 6, fontSize: 9, fontWeight: 700 },
  thumbnailRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  thumbnailImage: { maxWidth: 190, maxHeight: 140, objectFit: "contain" },
  // Khusus Surat Perintah Lembur — blok teks polos (bukan tabel berbingkai)
  // + grid tanda tangan tanpa garis kolom, sesuai format yang diberikan.
  otSectionTitle: { fontWeight: 700, marginTop: 10, marginBottom: 4 },
  otInfoRow: { flexDirection: "row", marginLeft: 24, marginBottom: 2 },
  otInfoLabel: { width: 80 },
  otInfoColon: { width: 10 },
  otInfoValue: { flex: 1 },
  otClosing: { marginTop: 12 },
  otCityDate: { marginTop: 10 },
  otColumnsRow: { flexDirection: "row", marginTop: 4 },
  otColumnHead: { flex: 1, paddingHorizontal: 4, fontSize: 8, fontWeight: 700, textAlign: "center" },
  otColumnBody: { flex: 1, height: 55, alignItems: "center", justifyContent: "center" },
  otColumnName: { flex: 1, paddingHorizontal: 4, fontSize: 7.5, textAlign: "center" },
  // Footer tetap (fixed) — dipakai di SEMUA jenis surat (bukan cuma
  // Lembur), pengganti header lama (nama perusahaan/alamat/timestamp di
  // atas sudah dihapus dari semua format).
  footer: {
    position: "absolute",
    bottom: 24,
    left: 32,
    right: 32,
    borderTopWidth: 1,
    borderTopColor: "#d4d4d4",
    paddingTop: 6,
    fontSize: 7,
    color: "#9ca3af",
    textAlign: "center",
  },
})

// Footer wajib di semua surat (fixed — otomatis diulang di tiap halaman).
function Footer({ generatedBy }: { generatedBy: string }) {
  return (
    <View style={styles.footer} fixed>
      <Text>
        {formatPrintedAt(new Date())} · E-HRM | BANK GRESIK · Digenerate oleh {generatedBy}
      </Text>
      <Text>Dokumen ini dicetak menggunakan sistem HRM Bank Gresik.</Text>
    </View>
  )
}

// Nomor surat (pakai publicId — referensi unik yang sama dipakai di nama
// file unduhan & URL detail izin) di pojok kanan atas, pengganti header lama.
function DocNumber({ publicId }: { publicId: string }) {
  return (
    <View style={styles.docNumberRow}>
      <Text style={styles.docNumberText}>No. Surat: {publicId}</Text>
    </View>
  )
}

// Lampiran bergambar (foto) digabung ke halaman surat yang sama, bukan
// dipisah — dokumen non-gambar (PDF) tetap pakai IzinAttachmentPage
// terpisah karena tidak bisa di-thumbnail.
function AttachmentThumbnails({
  attachments,
}: {
  attachments: { label: string; url: string }[]
}) {
  const images = attachments.filter((a) => isImageUrl(a.url))
  if (images.length === 0) return null

  return (
    <View>
      <Text style={styles.attachmentSectionTitle}>Foto Pendukung :</Text>
      <View style={styles.thumbnailRow}>
        {images.map((attachment, index) => {
          const buffer = localImageBuffer(attachment.url)
          if (!buffer) return null
          return (
            // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image, bukan <img> DOM (tidak punya prop alt)
            <Image key={`${attachment.url}-${index}`} src={buffer} style={styles.thumbnailImage} />
          )
        })}
      </View>
    </View>
  )
}

function ApprovalColumnHead({ column, isLast }: { column: ApprovalColumnPrint; isLast: boolean }) {
  return (
    <View style={[styles.approvalHead, isLast ? { borderRightWidth: 0 } : {}]}>
      <Text style={styles.approvalHeadText}>{column.label}</Text>
      {column.sublabel ? <Text style={styles.approvalHeadText}>{column.sublabel}</Text> : null}
    </View>
  )
}

function ApprovalColumnBody({ column, isLast }: { column: ApprovalColumnPrint; isLast: boolean }) {
  const signatureBuffer = column.signatureUrl ? localImageBuffer(column.signatureUrl) : null
  return (
    <View style={[styles.approvalBody, isLast ? { borderRightWidth: 0 } : {}]}>
      {column.status === "APPROVED" && signatureBuffer ? (
        // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image, bukan <img> DOM (tidak punya prop alt)
        <Image src={signatureBuffer} style={styles.signatureImage} />
      ) : column.status === "REJECTED" ? (
        <Text style={styles.rejectedText}>Ditolak</Text>
      ) : column.status === "APPROVED" ? (
        <Text style={styles.processText}>-</Text>
      ) : (
        <Text style={styles.processText}>Proses...</Text>
      )}
    </View>
  )
}

// Header (nama perusahaan/alamat/logo) sengaja dihilangkan dari semua
// format surat — footer tetap (fixed, di tiap halaman) jadi satu-satunya
// penanda sistem, lihat komponen Footer di bawah.
export function IzinPrintPage({
  doc,
  generatedBy,
}: {
  doc: IzinPrintDocument
  generatedBy: string
}) {
  const allColumns = [...doc.approvalColumns, doc.applicantColumn]
  const infoRows = [
    { label: "Nama", value: doc.applicantName },
    { label: "NIPD", value: doc.applicantNumber },
    { label: "Jabatan", value: doc.applicantPosition },
    ...doc.infoRows,
  ]

  return (
    <Page size="A4" style={styles.page}>
      <DocNumber publicId={doc.publicId} />

      <Text style={styles.perihal}>
        Perihal : <Text style={styles.bold}>{doc.perihal}</Text>
      </Text>

      <View style={styles.table}>
        {infoRows.map((row, i) => (
          <View key={row.label} style={i === infoRows.length - 1 ? styles.trLast : styles.tr}>
            <Text style={styles.tdLabel}>{row.label}</Text>
            <Text style={styles.tdColon}>:</Text>
            <Text style={styles.tdValue}>{row.value}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.cityDate}>{doc.cityDateLabel}</Text>

      <View style={styles.table}>
        <View style={styles.tr}>
          {allColumns.map((col, i) => (
            <ApprovalColumnHead key={`${col.label}-${i}`} column={col} isLast={i === allColumns.length - 1} />
          ))}
        </View>
        <View style={styles.tr}>
          {allColumns.map((col, i) => (
            <ApprovalColumnBody key={`${col.label}-${i}`} column={col} isLast={i === allColumns.length - 1} />
          ))}
        </View>
        <View style={styles.trLast}>
          {allColumns.map((col, i) => (
            <Text
              key={`${col.label}-${i}`}
              style={[styles.approvalName, i === allColumns.length - 1 ? { borderRightWidth: 0 } : {}]}
            >
              {col.signerName ?? "-"}
            </Text>
          ))}
        </View>
      </View>

      <View style={styles.notesBox}>
        <Text>Catatan :</Text>
        {approvalFlowNotes(doc.approvalColumns).map((line) => (
          <Text key={line} style={styles.notesBoxLine}>
            {line}
          </Text>
        ))}
      </View>

      {doc.noteWarning ? (
        <View style={styles.warningBox}>
          <Text>{doc.noteWarning}</Text>
        </View>
      ) : null}

      <AttachmentThumbnails attachments={doc.attachments} />

      <Footer generatedBy={generatedBy} />
    </Page>
  )
}

// "Surat Perintah Lembur" — format khusus, beda struktur dari IzinPrintPage
// (blok teks polos + grid tanda tangan tanpa garis kolom, diawali kolom
// Pemohon, bukan tabel info berbingkai diakhiri Pemohon). Header nama
// perusahaan/alamat sengaja dihilangkan — timestamp & label sistem
// dipindah jadi footer (fixed, muncul di tiap halaman), dilengkapi nama
// yang men-generate & keterangan sumber dokumen.
export function OvertimePrintPage({
  doc,
  generatedBy,
}: {
  doc: OvertimePrintDocument
  generatedBy: string
}) {
  return (
    <Page size="A4" style={styles.page}>
      <DocNumber publicId={doc.publicId} />

      <Text style={styles.otSectionTitle}>Yang Bertanda tangan di bawah ini</Text>
      <View style={styles.otInfoRow}>
        <Text style={styles.otInfoLabel}>Nama</Text>
        <Text style={styles.otInfoColon}>:</Text>
        <Text style={styles.otInfoValue}>{doc.supervisorName}</Text>
      </View>
      <View style={styles.otInfoRow}>
        <Text style={styles.otInfoLabel}>Jabatan</Text>
        <Text style={styles.otInfoColon}>:</Text>
        <Text style={styles.otInfoValue}>{doc.supervisorPosition}</Text>
      </View>

      <Text style={styles.otSectionTitle}>Menunjuk Kepada</Text>
      <View style={styles.otInfoRow}>
        <Text style={styles.otInfoLabel}>Nama</Text>
        <Text style={styles.otInfoColon}>:</Text>
        <Text style={styles.otInfoValue}>{doc.applicantName}</Text>
      </View>
      <View style={styles.otInfoRow}>
        <Text style={styles.otInfoLabel}>Jabatan</Text>
        <Text style={styles.otInfoColon}>:</Text>
        <Text style={styles.otInfoValue}>{doc.applicantPosition}</Text>
      </View>

      <Text style={styles.otSectionTitle}>Keterangan Lembur</Text>
      <View style={styles.otInfoRow}>
        <Text style={styles.otInfoLabel}>Tanggal</Text>
        <Text style={styles.otInfoColon}>:</Text>
        <Text style={styles.otInfoValue}>{doc.tanggal}</Text>
      </View>
      <View style={styles.otInfoRow}>
        <Text style={styles.otInfoLabel}>Pukul</Text>
        <Text style={styles.otInfoColon}>:</Text>
        <Text style={styles.otInfoValue}>{doc.pukul}</Text>
      </View>
      <View style={styles.otInfoRow}>
        <Text style={styles.otInfoLabel}>Tempat</Text>
        <Text style={styles.otInfoColon}>:</Text>
        <Text style={styles.otInfoValue}>{doc.tempat}</Text>
      </View>
      <View style={styles.otInfoRow}>
        <Text style={styles.otInfoLabel}>Kegiatan</Text>
        <Text style={styles.otInfoColon}>:</Text>
        <Text style={styles.otInfoValue}>{doc.kegiatan}</Text>
      </View>
      <View style={styles.otInfoRow}>
        <Text style={styles.otInfoLabel}>Keterangan Lembur</Text>
        <Text style={styles.otInfoColon}>:</Text>
        <Text style={styles.otInfoValue}>{doc.keteranganLembur}</Text>
      </View>

      <Text style={styles.otClosing}>
        Demikian Surat Perintah Lembur ini dibuat untuk dipergunakan sebagaimana mestinya.
      </Text>

      <Text style={styles.otCityDate}>{doc.cityDateLabel}</Text>

      <View style={styles.otColumnsRow}>
        {doc.columns.map((col, i) => (
          <View key={`${col.label}-${i}`} style={styles.otColumnHead}>
            <Text>{col.label}</Text>
            {col.sublabel ? <Text>{col.sublabel}</Text> : null}
          </View>
        ))}
      </View>
      <View style={styles.otColumnsRow}>
        {doc.columns.map((col, i) => {
          const signatureBuffer = col.signatureUrl ? localImageBuffer(col.signatureUrl) : null
          return (
            <View key={`${col.label}-${i}`} style={styles.otColumnBody}>
              {col.status === "APPROVED" && signatureBuffer ? (
                // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image, bukan <img> DOM (tidak punya prop alt)
                <Image src={signatureBuffer} style={styles.signatureImage} />
              ) : col.status === "REJECTED" ? (
                <Text style={styles.rejectedText}>Ditolak</Text>
              ) : col.status === "APPROVED" ? (
                <Text style={styles.processText}>-</Text>
              ) : (
                <Text style={styles.processText}>Proses...</Text>
              )}
            </View>
          )
        })}
      </View>
      <View style={styles.otColumnsRow}>
        {doc.columns.map((col, i) => (
          <Text key={`${col.label}-${i}`} style={styles.otColumnName}>
            {col.signerName ?? "________________"}
          </Text>
        ))}
      </View>

      <View style={styles.notesBox}>
        <Text>Catatan :</Text>
        {approvalFlowNotes(doc.columns).map((line) => (
          <Text key={line} style={styles.notesBoxLine}>
            {line}
          </Text>
        ))}
      </View>

      <AttachmentThumbnails attachments={doc.attachments} />

      <Footer generatedBy={generatedBy} />
    </Page>
  )
}

// Header (nomor surat) & footer juga dipasang di halaman lampiran — biar
// tiap lampiran tetap jelas identitasnya (punya izin/surat yang mana) kalau
// dicetak/dibuka terpisah dari halaman utama suratnya.
export function IzinAttachmentPage({
  publicId,
  label,
  applicantName,
  url,
  generatedBy,
}: {
  publicId: string
  label: string
  applicantName: string
  url: string
  generatedBy: string
}) {
  const imageBuffer = isImageUrl(url) ? localImageBuffer(url) : null

  return (
    <Page size="A4" style={styles.page}>
      <DocNumber publicId={publicId} />

      <Text style={styles.attachmentLabel}>Lampiran — {applicantName}</Text>
      <Text style={styles.attachmentTitle}>{label}</Text>
      {imageBuffer ? (
        // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image, bukan <img> DOM (tidak punya prop alt)
        <Image src={imageBuffer} style={styles.attachmentImage} />
      ) : (
        <Link src={url} style={styles.attachmentLink}>
          Lampiran PDF, buka terpisah: {url}
        </Link>
      )}

      <Footer generatedBy={generatedBy} />
    </Page>
  )
}

// Entri campuran, urut sesuai baris yang dicentang user di Monitoring Izin —
// Lembur pakai format Surat Perintah Lembur sendiri (lihat OvertimePrintPage
// / getOvertimePrintDocuments di lib/izin-print.ts), 10 jenis izin lain
// pakai format generik (IzinPrintPage).
export type IzinPrintEntry =
  | { type: "generic"; doc: IzinPrintDocument }
  | { type: "overtime"; doc: OvertimePrintDocument }

// Cuma render halaman surat (+ thumbnail foto inline, lihat
// AttachmentThumbnails) — lampiran PDF asli (dokumen pendukung, surat
// dokter, dst) TIDAK dirender di sini. Halaman PDF-nya di-copy langsung
// (bukan ditautkan) oleh mergeIzinPrintPdf di
// lib/reports/izin-print-merge.tsx, yang memanggil komponen ini SEKALI per
// entry lalu menyisipkan halaman lampiran itu persis setelahnya.
export function IzinPrintPdfDocument({
  entries,
  generatedBy,
}: {
  entries: IzinPrintEntry[]
  generatedBy: string
}) {
  return (
    <Document>
      {entries.map((entry) =>
        entry.type === "overtime" ? (
          <OvertimePrintPage key={entry.doc.publicId} doc={entry.doc} generatedBy={generatedBy} />
        ) : (
          <IzinPrintPage key={entry.doc.publicId} doc={entry.doc} generatedBy={generatedBy} />
        )
      )}
    </Document>
  )
}
