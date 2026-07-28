import path from "path";
import { readFileSync } from "fs";

import type { Style } from "@react-pdf/stylesheet";
import {
  Document,
  Page,
  View,
  Text,
  Image,
  Link,
  StyleSheet,
} from "@react-pdf/renderer";

import type {
  IzinPrintDocument,
  OvertimePrintDocument,
  CutiFormalPrintDocument,
  ApprovalColumnPrint,
  ConsiderationColumnPrint,
} from "@/lib/izin-print";

const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".gif"];

function isImageUrl(url: string) {
  const lower = url.toLowerCase();
  return IMAGE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

const FLOW_STATUS_LABEL: Record<ApprovalColumnPrint["status"], string> = {
  WAITING: "Menunggu",
  IN_PROGRESS: "Diproses",
  APPROVED: "Disetujui",
  REJECTED: "Ditolak",
  REVISED: "Revisi",
  SKIPPED: "Dilewati",
};

// Ringkasan waktu approve & alur approval — ditambahkan sebagai catatan di
// surat cetak. Kolom Pemohon dikeluarkan (bukan bagian alur approval,
// cuma tanda tangan pengaju).
function approvalFlowNotes(columns: ApprovalColumnPrint[]): string[] {
  return columns
    .filter((c) => c.label !== "Pemohon" && c.label !== "Dibuat")
    .map((c) => {
      const statusLabel = FLOW_STATUS_LABEL[c.status];
      const who = c.signerName ? ` oleh ${c.signerName}` : "";
      const when = c.actedAt ? ` — ${c.actedAt}` : "";
      return `${c.label}: ${statusLabel}${who}${when}`;
    });
}

// URL upload disimpan sebagai path relatif ("/uploads/...") — react-pdf
// jalan di Node (bukan browser), jadi gambar diambil langsung dari disk
// (public/**) alih-alih lewat HTTP. Sengaja dibaca jadi Buffer (bukan
// dioper sebagai path string ke prop `src`) — react-pdf mem-parsing path
// pakai `url.parse()`, yang salah mengira drive letter Windows (mis. "D:")
// sebagai protocol URL, bikin file lokal gagal dimuat (coba fetch ke
// jaringan alih-alih baca disk). Buffer melewati masalah itu sepenuhnya.
function localImageBuffer(url: string): Buffer | null {
  if (!url.startsWith("/")) return null;
  const abs = path.join(process.cwd(), "public", url);
  try {
    return readFileSync(abs);
  } catch {
    return null;
  }
}

function formatPrintedAt(date: Date) {
  return date.toLocaleString("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const styles = StyleSheet.create({
  page: {
    padding: 32,
    paddingTop: 10,
    paddingBottom: 60,
    fontSize: 9,
    fontFamily: "Helvetica",
    color: "#111111",
  },
  // Kop surat (IzinSettings.letterheadUrl) — banner di paling atas halaman,
  // DI LUAR/DI ATAS baris No. Surat, sama posisinya dengan pola di
  // lib/reports/payslip-pdf.tsx.
  letterheadRow: { marginBottom: 10 },
  letterheadImage: { width: "100%" },
  docNumberRow: { alignItems: "flex-end", marginBottom: 8 },
  docNumberText: { fontSize: 8, color: "#737373" },
  docTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  docTitleText: { fontSize: 14, fontWeight: 700 },
  perihal: { marginTop: 4, marginBottom: 6 },
  bold: { fontWeight: 700 },
  table: { borderWidth: 1, borderColor: "#d4d4d4" },
  tr: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#d4d4d4",
  },
  trLast: { flexDirection: "row" },
  tdLabel: {
    width: 110,
    padding: 5,
    fontWeight: 700,
    borderRightWidth: 1,
    borderRightColor: "#d4d4d4",
  },
  tdColon: {
    width: 14,
    padding: 5,
    textAlign: "center",
    borderRightWidth: 1,
    borderRightColor: "#d4d4d4",
  },
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
  attachmentSectionTitle: {
    marginTop: 12,
    marginBottom: 6,
    fontSize: 9,
    fontWeight: 700,
  },
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
  otColumnHead: {
    flex: 1,
    paddingHorizontal: 4,
    fontSize: 8,
    fontWeight: 700,
    textAlign: "center",
  },
  otColumnBody: {
    flex: 1,
    height: 55,
    alignItems: "center",
    justifyContent: "center",
  },
  otColumnName: {
    flex: 1,
    paddingHorizontal: 4,
    fontSize: 7.5,
    textAlign: "center",
  },
  // Khusus Surat Permohonan Cuti (format resmi >3 hari / Bersalin / Khusus /
  // Besar) — blok "Kepada Yth", paragraf mengalir dengan bagian bold inline,
  // tabel data pegawai, ringkasan cuti terpakai, dan 3 kotak
  // catatan/pertimbangan approval.
  cfKepadaBlock: { marginBottom: 10 },
  cfKepadaCity: { fontWeight: 700 },
  cfPerihalValue: { fontWeight: 700, textDecoration: "underline" },
  // JANGAN tambahkan `lineHeight` di style paragraf mana pun di file ini.
  // Di react-pdf versi ini, MENYETEL lineHeight (nilai berapa pun — 1, 1.25,
  // maupun 1.5) mengaktifkan perhitungan tinggi baris yang jauh lebih longgar,
  // sehingga baris-baris dalam satu paragraf tampak seperti paragraf
  // terpisah-pisah saat dicetak. Tanpa properti itu, react-pdf memakai metrik
  // font natural yang rapat & sesuai format surat aslinya. Sudah diuji
  // berdampingan (default vs lineHeight 1/1.25/1.5) — cuma varian TANPA
  // lineHeight yang rapat. `textAlign: justify` aman, tidak memengaruhi ini.
  cfParagraph: { marginBottom: 8, textAlign: "justify" },
  cfParagraphBold: { fontWeight: 700 },
  cfSectionLabel: { marginTop: 10, marginBottom: 4, fontWeight: 700 },
  cfSignatureBlock: { marginTop: 14, alignItems: "flex-end" },
  cfSignatureBox: { width: 220, textAlign: "center" },
  cfSignatureImage: {
    width: 90,
    height: 45,
    objectFit: "contain",
    alignSelf: "center",
    marginVertical: 4,
  },
  cfSignatureName: { fontWeight: 700, textDecoration: "underline" },
  cfConsumptionList: { marginLeft: 8, marginTop: 2 },
  cfConsumptionLine: { marginTop: 2 },
  cfConsiderationRow: { flexDirection: "row", marginTop: 20, gap: 6 },
  cfConsiderationCol: { flex: 1 },
  cfConsiderationLabel: {
    fontSize: 7.5,
    fontWeight: 700,
    marginBottom: 3,
    textAlign: "center",
  },
  cfConsiderationBox: {
    minHeight: 55,
    borderWidth: 1,
    borderColor: "#d4d4d4",
    borderRadius: 2,
    padding: 5,
  },
  cfConsiderationNote: { fontSize: 7.5 },
  cfConsiderationNoteEmpty: { fontSize: 7.5, color: "#a3a3a3" },
  cfConsiderationSignature: {
    width: 60,
    height: 28,
    objectFit: "contain",
    alignSelf: "flex-end",
    marginTop: 4,
  },
  cfConsiderationCaption: { fontSize: 6.5, color: "#737373", marginTop: 4 },
  cfInfoRow: { flexDirection: "row", marginLeft: 24, marginBottom: 2 },
  cfInfoLabel: { width: 70 },
  cfInfoColon: { width: 10 },
  cfInfoValue: { flex: 1 },
  cfSubstituteRow: { marginTop: 30 },
  cfSubstituteSignatureBlock: { width: 200, marginTop: 15 },
  cfSubstituteSignatureBox: {
    minHeight: 55,
    borderWidth: 1,
    borderColor: "#d4d4d4",
    borderRadius: 2,
    padding: 5,
  },
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
});

// Footer wajib di semua surat (fixed — otomatis diulang di tiap halaman).
function Footer({ generatedBy }: { generatedBy: string }) {
  return (
    <View style={styles.footer} fixed>
      <Text>
        {formatPrintedAt(new Date())} · E-HRIS | BANK GRESIK · Digenerate oleh{" "}
        {generatedBy}
      </Text>
      <Text>Dokumen ini dicetak menggunakan sistem HRIS Bank Gresik.</Text>
    </View>
  );
}

// Banner kop surat perusahaan (IzinSettings.letterheadUrl) — dirender
// SEBELUM DocNumber (paling atas halaman) kalau admin sudah upload lewat
// Pengaturan Izin. null/gambar gagal dibaca = tidak render apa-apa (PDF
// tetap tampil normal seperti sebelum fitur ini ada).
function Letterhead({ url }: { url: string | null }) {
  const buffer = url ? localImageBuffer(url) : null;
  if (!buffer) return null;
  return (
    <View style={styles.letterheadRow}>
      {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image, bukan <img> DOM (tidak punya prop alt) */}
      <Image src={buffer} style={styles.letterheadImage} />
    </View>
  );
}

// Nomor surat (pakai publicId — referensi unik yang sama dipakai di nama
// file unduhan & URL detail izin) di pojok kanan atas, pengganti header lama.
// `title` opsional — cuma diisi OvertimePrintPage ("Surat Pengajuan Lembur"),
// format izin generik lain tidak pakai judul di posisi ini.
function DocNumber({ publicId, title }: { publicId: string; title?: string }) {
  if (title) {
    return (
      <View style={styles.docTitleRow}>
        <Text style={styles.docTitleText}>{title}</Text>
        <Text style={styles.docNumberText}>No. Surat: {publicId}</Text>
      </View>
    );
  }
  return (
    <View style={styles.docNumberRow}>
      <Text style={styles.docNumberText}>No. Surat: {publicId}</Text>
    </View>
  );
}

// Lampiran bergambar (foto) digabung ke halaman surat yang sama, bukan
// dipisah — dokumen non-gambar (PDF) tetap pakai IzinAttachmentPage
// terpisah karena tidak bisa di-thumbnail.
function AttachmentThumbnails({
  publicId,
  attachments,
}: {
  publicId: string;
  attachments: { label: string; url: string }[];
}) {
  const images = attachments.filter((a) => isImageUrl(a.url));
  if (images.length === 0) return null;

  return (
    // `break` — selalu mulai halaman baru buat bagian ini, bukan cuma kalau
    // kepepet ruang. Tanpa ini, judul "Foto Pendukung :" gampang kepisah
    // sendirian di sisa halaman pertama (nyaris kosong) sementara fotonya
    // baru muncul di halaman berikutnya — sekarang judul & foto selalu
    // bareng di halaman baru. Halaman baru ini butuh No. Surat sendiri
    // (DocNumber) karena bukan `fixed`, jadi tidak otomatis ikut dari
    // halaman surat sebelumnya.
    <View break>
      <DocNumber publicId={publicId} />
      <Text style={styles.attachmentSectionTitle}>Foto Pendukung :</Text>
      <View style={styles.thumbnailRow}>
        {images.map((attachment, index) => {
          const buffer = localImageBuffer(attachment.url);
          if (!buffer) return null;
          return (
            // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image, bukan <img> DOM (tidak punya prop alt)
            <Image
              key={`${attachment.url}-${index}`}
              src={buffer}
              style={styles.thumbnailImage}
            />
          );
        })}
      </View>
    </View>
  );
}

function ApprovalColumnHead({
  column,
  isLast,
}: {
  column: ApprovalColumnPrint;
  isLast: boolean;
}) {
  return (
    <View style={[styles.approvalHead, isLast ? { borderRightWidth: 0 } : {}]}>
      <Text style={styles.approvalHeadText}>{column.label}</Text>
      {column.sublabel ? (
        <Text style={styles.approvalHeadText}>{column.sublabel}</Text>
      ) : null}
    </View>
  );
}

function ApprovalColumnBody({
  column,
  isLast,
}: {
  column: ApprovalColumnPrint;
  isLast: boolean;
}) {
  const signatureBuffer = column.signatureUrl
    ? localImageBuffer(column.signatureUrl)
    : null;
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
  );
}

// Header (nama perusahaan/alamat/logo) sengaja dihilangkan dari semua
// format surat — footer tetap (fixed, di tiap halaman) jadi satu-satunya
// penanda sistem, lihat komponen Footer di bawah.
export function IzinPrintPage({
  doc,
  generatedBy,
}: {
  doc: IzinPrintDocument;
  generatedBy: string;
}) {
  const allColumns = [...doc.approvalColumns, doc.applicantColumn];
  const infoRows = [
    { label: "Nama", value: doc.applicantName },
    { label: "NIPD", value: doc.applicantNumber },
    { label: "Jabatan", value: doc.applicantPosition },
    ...doc.infoRows,
  ];

  return (
    <Page size="A4" style={styles.page}>
      <Letterhead url={doc.letterheadUrl} />
      <DocNumber publicId={doc.publicId} />

      <Text style={styles.perihal}>
        Perihal : <Text style={styles.bold}>{doc.perihal}</Text>
      </Text>

      <View style={styles.table}>
        {infoRows.map((row, i) => (
          <View
            key={row.label}
            style={i === infoRows.length - 1 ? styles.trLast : styles.tr}
          >
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
            <ApprovalColumnHead
              key={`${col.label}-${i}`}
              column={col}
              isLast={i === allColumns.length - 1}
            />
          ))}
        </View>
        <View style={styles.tr}>
          {allColumns.map((col, i) => (
            <ApprovalColumnBody
              key={`${col.label}-${i}`}
              column={col}
              isLast={i === allColumns.length - 1}
            />
          ))}
        </View>
        <View style={styles.trLast}>
          {allColumns.map((col, i) => (
            <Text
              key={`${col.label}-${i}`}
              style={[
                styles.approvalName,
                i === allColumns.length - 1 ? { borderRightWidth: 0 } : {},
              ]}
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

      <AttachmentThumbnails
        publicId={doc.publicId}
        attachments={doc.attachments}
      />

      <Footer generatedBy={generatedBy} />
    </Page>
  );
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
  doc: OvertimePrintDocument;
  generatedBy: string;
}) {
  return (
    <Page size="A4" style={styles.page}>
      <Letterhead url={doc.letterheadUrl} />
      <DocNumber publicId={doc.publicId} title="Surat Pengajuan Lembur" />

      <Text style={styles.otSectionTitle}>
        Yang Bertanda tangan di bawah ini
      </Text>
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
        Demikian Surat Perintah Lembur ini dibuat untuk dipergunakan sebagaimana
        mestinya.
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
          const signatureBuffer = col.signatureUrl
            ? localImageBuffer(col.signatureUrl)
            : null;
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
          );
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

      <AttachmentThumbnails
        publicId={doc.publicId}
        attachments={doc.attachments}
      />

      <Footer generatedBy={generatedBy} />
    </Page>
  );
}

const CONSUMPTION_LINES = [
  { key: "cutiTahunanHari" as const, label: "Cuti Tahunan" },
  { key: "cutiBesarHari" as const, label: "Cuti Besar" },
  { key: "cutiSakitHari" as const, label: "Cuti Sakit" },
  { key: "cutiMelahirkanHari" as const, label: "Cuti Melahirkan" },
];

function considerationCaption(col: ConsiderationColumnPrint): string {
  const statusLabel = FLOW_STATUS_LABEL[col.status];
  const who = col.signerName ? ` oleh ${col.signerName}` : "";
  const when = col.actedAt ? ` — ${col.actedAt}` : "";
  return `${statusLabel}${who}${when}`;
}

// Note kecil di bawah kotak tanda tangan Pengganti — kapan pengganti
// menyatakan bersedia (atau status konfirmasinya kalau belum/tidak
// bersedia), sama gayanya dengan considerationCaption di atas.
function substituteCaption(
  substitute: CutiFormalPrintDocument["substitute"],
): string {
  if (!substitute || !substitute.status) return "Menunggu konfirmasi";
  const statusLabel = FLOW_STATUS_LABEL[substitute.status];
  const when = substitute.actedAt ? ` — ${substitute.actedAt}` : "";
  return `${statusLabel}${when}`;
}

function ConsiderationColumn({ column }: { column: ConsiderationColumnPrint }) {
  const signatureBuffer =
    column.status === "APPROVED" && column.signatureUrl
      ? localImageBuffer(column.signatureUrl)
      : null;
  return (
    <View style={styles.cfConsiderationCol}>
      <Text style={styles.cfConsiderationLabel}>{column.label}</Text>
      <View style={styles.cfConsiderationBox}>
        {column.note ? (
          <Text style={styles.cfConsiderationNote}>{column.note}</Text>
        ) : (
          <Text style={styles.cfConsiderationNoteEmpty}>-</Text>
        )}
        {signatureBuffer ? (
          // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image, bukan <img> DOM (tidak punya prop alt)
          <Image
            src={signatureBuffer}
            style={styles.cfConsiderationSignature}
          />
        ) : column.status === "REJECTED" ? (
          <Text style={styles.rejectedText}>Ditolak</Text>
        ) : null}
      </View>
      <Text style={styles.cfConsiderationCaption}>
        {considerationCaption(column)}
      </Text>
    </View>
  );
}

// Paragraf dengan bagian tebal di tengah kalimat. Potongan teksnya sengaja
// dibangun sebagai array JS biasa lalu dirender lewat .map — BUKAN ditulis
// sebagai teks JSX multi-baris. react-pdf merender newline di dalam <Text>
// secara literal (tidak di-collapse seperti HTML), jadi kalimat panjang yang
// dipecah beberapa baris di kode sumber — entah manual atau oleh formatter —
// ikut terpotong di hasil cetak. Lewat array, isi string-nya tetap utuh
// bagaimanapun kode sumbernya dirapikan.
type ParagraphPart = string | { bold: true; text: string };

function RichParagraph({
  parts,
  style,
}: {
  parts: ParagraphPart[];
  style?: Style | Style[];
}) {
  return (
    <Text style={style}>
      {parts.map((part, i) =>
        typeof part === "string" ? (
          part
        ) : (
          <Text key={i} style={styles.cfParagraphBold}>
            {part.text}
          </Text>
        ),
      )}
    </Text>
  );
}

// "Surat Permohonan Cuti" resmi — dipakai buat Cuti Tahunan >3 hari, Cuti
// Bersalin/Gugur Kandungan, Cuti Khusus (Haji/Umroh), dan Cuti Besar (lihat
// getCutiFormalPrintDocuments di lib/izin-print.ts). Beda dari IzinPrintPage
// generik: format surat resmi mengalir (bukan tabel info + kolom
// approval), berisi ringkasan cuti terpakai & 3 kotak catatan/pertimbangan
// approval per jabatan (Atasan Langsung / Kabag Personalia & Umum /
// Direksi), bukan tanda tangan per kolom.
export function CutiFormalPrintPage({
  doc,
  generatedBy,
}: {
  doc: CutiFormalPrintDocument;
  generatedBy: string;
}) {
  const infoRows = [
    { label: "Nama", value: doc.applicantName },
    { label: "NIP", value: doc.applicantNumber },
    { label: "Jabatan", value: doc.applicantPosition },
  ];
  const signatureBuffer = doc.signerSignatureUrl
    ? localImageBuffer(doc.signerSignatureUrl)
    : null;
  const substituteSignatureBuffer = doc.substitute?.signatureUrl
    ? localImageBuffer(doc.substitute.signatureUrl)
    : null;

  const introParagraph = `Berdasarkan Surat Permohonan Cuti tanggal ${doc.submissionDateLabel}, dengan data pegawai sebagai berikut:`;

  // Bagian yang ditebalkan mengikuti format surat aslinya: jenis cuti,
  // durasi, rentang tanggal, alamat, dan nomor telepon.
  const requestParagraphParts: ParagraphPart[] = [
    "Dengan ini kami mengajukan permintaan ",
    { bold: true, text: doc.leaveTypeLabel },
    " selama ",
    { bold: true, text: doc.durationLabel },
    ", terhitung tanggal ",
    { bold: true, text: `${doc.startDateLabel} s/d ${doc.endDateLabel}` },
    ", selama menjalankan cuti, pegawai yang bersangkutan bersedia dihubungi untuk urusan pekerjaan dengan Alamat di ",
    { bold: true, text: doc.applicantAddress },
    ", Nomor Telepon ",
    { bold: true, text: doc.applicantPhone },
    ".",
  ];

  return (
    <Page size="A4" style={styles.page}>
      <Letterhead url={doc.letterheadUrl} />
      <DocNumber publicId={doc.publicId} />

      <View style={styles.cfKepadaBlock}>
        <Text>Kepada Yth. :</Text>
        <Text>Direksi Perumda BPR Bank Gresik</Text>
        <Text>Di –</Text>
        <Text style={styles.cfKepadaCity}>G R E S I K</Text>
      </View>

      <Text style={styles.perihal}>
        Perihal : <Text style={styles.cfPerihalValue}>Permohonan Cuti</Text>
      </Text>

      <Text style={styles.cfParagraph}>{introParagraph}</Text>

      <View style={{ marginBottom: 8 }}>
        {infoRows.map((row) => (
          <View key={row.label} style={styles.cfInfoRow}>
            <Text style={styles.cfInfoLabel}>{row.label}</Text>
            <Text style={styles.cfInfoColon}>:</Text>
            <Text style={styles.cfInfoValue}>{row.value}</Text>
          </View>
        ))}
      </View>

      <RichParagraph parts={requestParagraphParts} style={styles.cfParagraph} />

      {doc.attachmentNote ? (
        <Text style={styles.cfParagraph}>{doc.attachmentNote}</Text>
      ) : null}

      <View style={styles.cfSignatureBlock}>
        <View style={styles.cfSignatureBox}>
          <Text>{doc.cityDateLabel}</Text>
          <Text style={{ marginTop: 4 }}>Kabag. Personalia & Umum</Text>
          {signatureBuffer ? (
            // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image, bukan <img> DOM (tidak punya prop alt)
            <Image src={signatureBuffer} style={styles.cfSignatureImage} />
          ) : (
            <View style={{ height: 45 }} />
          )}
          <Text style={styles.cfSignatureName}>
            {doc.signerName ?? "________________"}
          </Text>
        </View>
      </View>

      <Text style={styles.cfSectionLabel}>Catatan Pejabat Kepegawaian</Text>
      <Text>Cuti yang telah diambil dalam periode cuti :</Text>
      <View style={styles.cfConsumptionList}>
        {CONSUMPTION_LINES.map((line, i) => (
          <Text key={line.key} style={styles.cfConsumptionLine}>
            {i + 1}. {line.label} : {doc.leaveConsumption[line.key]} Hari
          </Text>
        ))}
        <Text style={styles.cfConsumptionLine}>
          {CONSUMPTION_LINES.length + 1}. Keterangan Lain-lain :
        </Text>
      </View>

      <View style={styles.cfConsiderationRow}>
        {doc.considerationColumns.map((col, i) => (
          <ConsiderationColumn key={`${col.label}-${i}`} column={col} />
        ))}
      </View>

      <View style={styles.cfSubstituteRow}>
        <Text>
          Pengganti pada saat cuti :{" "}
          <Text style={styles.bold}>{doc.substitute?.name ?? "-"}</Text>
        </Text>
        {doc.substitute ? (
          // wrap={false} — cegah kotak ini kepotong tengah antar halaman
          // (mis. judul "Tanda Tangan Pengganti" kebawa halaman sebelumnya,
          // sementara kotak & tanda tangannya sendiri di halaman berikutnya)
          // kalau posisinya pas mepet batas halaman.
          <View style={styles.cfSubstituteSignatureBlock} wrap={false}>
            <Text style={styles.cfConsiderationLabel}>
              Tanda Tangan Pengganti
            </Text>
            <View style={styles.cfSubstituteSignatureBox}>
              {doc.substitute.note ? (
                <Text style={styles.cfConsiderationNote}>
                  {doc.substitute.note}
                </Text>
              ) : (
                <Text style={styles.cfConsiderationNoteEmpty}>-</Text>
              )}
              {substituteSignatureBuffer &&
              doc.substitute.status === "APPROVED" ? (
                // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image, bukan <img> DOM (tidak punya prop alt)
                <Image
                  src={substituteSignatureBuffer}
                  style={styles.cfConsiderationSignature}
                />
              ) : null}
            </View>
            <Text style={styles.cfConsiderationCaption}>
              {substituteCaption(doc.substitute)}
            </Text>
          </View>
        ) : null}
      </View>

      <AttachmentThumbnails
        publicId={doc.publicId}
        attachments={doc.attachments}
      />

      <Footer generatedBy={generatedBy} />
    </Page>
  );
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
  publicId: string;
  label: string;
  applicantName: string;
  url: string;
  generatedBy: string;
}) {
  const imageBuffer = isImageUrl(url) ? localImageBuffer(url) : null;

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
  );
}

// Entri campuran, urut sesuai baris yang dicentang user di Monitoring Izin —
// Lembur pakai format Surat Perintah Lembur sendiri (lihat OvertimePrintPage
// / getOvertimePrintDocuments di lib/izin-print.ts), Cuti Tahunan >3 hari /
// Cuti Bersalin / Cuti Khusus / Cuti Besar pakai format Surat Permohonan
// Cuti resmi (CutiFormalPrintPage / getCutiFormalPrintDocuments), sisanya
// pakai format generik (IzinPrintPage).
export type IzinPrintEntry =
  | { type: "generic"; doc: IzinPrintDocument }
  | { type: "overtime"; doc: OvertimePrintDocument }
  | { type: "cuti-formal"; doc: CutiFormalPrintDocument };

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
  entries: IzinPrintEntry[];
  generatedBy: string;
}) {
  return (
    <Document>
      {entries.map((entry) => {
        if (entry.type === "overtime") {
          return (
            <OvertimePrintPage
              key={entry.doc.publicId}
              doc={entry.doc}
              generatedBy={generatedBy}
            />
          );
        }
        if (entry.type === "cuti-formal") {
          return (
            <CutiFormalPrintPage
              key={entry.doc.publicId}
              doc={entry.doc}
              generatedBy={generatedBy}
            />
          );
        }
        return (
          <IzinPrintPage
            key={entry.doc.publicId}
            doc={entry.doc}
            generatedBy={generatedBy}
          />
        );
      })}
    </Document>
  );
}
