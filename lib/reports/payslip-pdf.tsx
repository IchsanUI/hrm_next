import path from "path";
import { readFileSync } from "fs";

import {
  Document,
  Page,
  View,
  Text,
  Image,
  StyleSheet,
} from "@react-pdf/renderer";

import type {
  PayslipPrintDocument,
  PayslipPrintItem,
} from "@/lib/payroll/payslip-print";

function formatRupiahOrDash(value: number) {
  if (!value) return "-";
  return Math.round(value).toLocaleString("id-ID", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatRupiah(value: number) {
  return Math.round(value).toLocaleString("id-ID", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
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

// react-pdf jalan di Node, bukan browser — gambar tanda tangan diambil
// langsung dari disk (public/**), bukan lewat HTTP (lihat catatan sama di
// lib/reports/izin-print-pdf.tsx soal kenapa dibaca sebagai Buffer).
function localImageBuffer(url: string): Buffer | null {
  if (!url.startsWith("/")) return null;
  const abs = path.join(process.cwd(), "public", url);
  try {
    return readFileSync(abs);
  } catch {
    return null;
  }
}

// Palet warna disamakan dengan tema navy/aksen yang sudah dipakai di
// dashboard app (kartu profil biru tua, chip hijau/rose/biru) — biar
// dokumen cetak terasa satu identitas visual sama sistemnya, bukan lembar
// hitam-putih polos.
const COLORS = {
  navy: "#172554",
  navySoft: "#eef2ff",
  border: "#cbd5e1",
  penerimaan: "#1d4ed8",
  penerimaanBg: "#eff6ff",
  potongan: "#be123c",
  potonganBg: "#fff1f2",
  finalBg: "#ecfdf5",
  finalBorder: "#047857",
  finalText: "#047857",
  zebra: "#f8fafc",
  muted: "#6b7280",
  text: "#111111",
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 10,
    paddingHorizontal: 24,
    paddingBottom: 40,
    fontSize: 8,
    fontFamily: "Helvetica",
    color: COLORS.text,
  },
  outer: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 4,
    overflow: "hidden",
  },

  // Kop surat = HEADER halaman, DI LUAR kotak "Bukti Pembayaran Gaji" (bukan
  // bagian dari card itu) — banner resmi berdiri sendiri di paling atas,
  // baru di bawahnya kotak dokumennya.
  letterheadRow: { marginBottom: 10 },
  letterheadImage: { width: "100%" },

  titleBar: {
    backgroundColor: COLORS.navy,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  title: {
    fontSize: 13,
    fontWeight: 700,
    textAlign: "center",
    color: "#ffffff",
    letterSpacing: 1,
  },

  body: { padding: 12 },

  headerInfoRow: { flexDirection: "row", marginBottom: 10, gap: 12 },
  headerInfoCol: {
    flex: 1,
    backgroundColor: COLORS.navySoft,
    borderRadius: 3,
    padding: 8,
  },
  infoRow: { flexDirection: "row", marginBottom: 1.5 },
  infoLabel: { width: 62, color: COLORS.muted },
  infoColon: { width: 8 },
  infoValue: { flex: 1, fontWeight: 700 },

  ledgerRow: { flexDirection: "row", gap: 12 },
  ledgerCol: { flex: 1 },
  colHeaderPenerimaan: {
    fontWeight: 700,
    textAlign: "center",
    marginBottom: 4,
    color: "#ffffff",
    backgroundColor: COLORS.penerimaan,
    paddingVertical: 3,
    borderRadius: 2,
  },
  colHeaderPotongan: {
    fontWeight: 700,
    textAlign: "center",
    marginBottom: 4,
    color: "#ffffff",
    backgroundColor: COLORS.potongan,
    paddingVertical: 3,
    borderRadius: 2,
  },
  lineRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 1.5,
    paddingHorizontal: 3,
  },
  lineRowZebra: { backgroundColor: COLORS.zebra },
  lineLabel: { flex: 1 },
  lineColon: { width: 10, color: COLORS.muted },
  lineValue: { width: 85, textAlign: "right" },
  lineValueBold: { width: 85, textAlign: "right", fontWeight: 700 },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 3,
    paddingTop: 3,
    paddingHorizontal: 3,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  totalLabel: { flex: 1, fontWeight: 700 },
  sectionGap: { marginTop: 8 },
  subHeader: { fontWeight: 700, marginBottom: 3, color: COLORS.navy },
  emptyLine: { color: "#9ca3af", paddingHorizontal: 3 },

  finalBoxRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 12,
  },
  finalBox: {
    borderWidth: 1,
    borderColor: COLORS.finalBorder,
    backgroundColor: COLORS.finalBg,
    borderRadius: 3,
    paddingVertical: 5,
    paddingHorizontal: 12,
    flexDirection: "row",
    gap: 10,
  },
  finalBoxLabel: { fontWeight: 700, color: COLORS.finalText },
  finalBoxValue: { fontWeight: 700, color: COLORS.finalText, fontSize: 10 },

  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16,
  },
  ketColumn: { width: "45%" },
  ketRow: { flexDirection: "row", marginBottom: 1.5 },
  ketLabel: { width: 90 },
  ketColon: { width: 8 },
  signColumn: { width: "45%", textAlign: "center" },
  signCityDate: { marginBottom: 1 },
  signSpace: { height: 34, alignItems: "center", justifyContent: "center" },
  signImage: { height: 34, objectFit: "contain" },
  signName: { textDecoration: "underline", fontWeight: 700 },

  footnote: { marginTop: 8, fontSize: 7, color: COLORS.muted },

  // Nomor slip + QR code — pojok kanan bawah dokumen (di dalam kotak border
  // utama, di atas footer generated-by fixed halaman).
  slipNumberRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "flex-end",
    marginTop: 14,
    gap: 6,
  },
  slipNumberTextBlock: { alignItems: "flex-end" },
  slipNumberLabel: { fontSize: 6, color: COLORS.muted },
  slipNumberValue: { fontSize: 7, fontWeight: 700, color: COLORS.navy },
  qrImage: { width: 40, height: 40 },

  pageFooter: {
    position: "absolute",
    bottom: 14,
    left: 24,
    right: 24,
    borderTopWidth: 1,
    borderTopColor: "#d4d4d4",
    paddingTop: 4,
    fontSize: 6,
    color: "#9ca3af",
    textAlign: "center",
  },

  // Watermark — grid teks berulang (bukan tiap Text dirotasi satu-satu),
  // seluruh grid-nya sendiri yang dirotasi lalu "dibentangkan" melebihi
  // batas halaman (top/left/right/bottom negatif) supaya area diagonalnya
  // tetap menutupi seluruh halaman A4 setelah rotasi. Dirender PALING
  // TERAKHIR (di atas konten lain, bukan di belakang) dengan opacity
  // rendah — supaya tetap kelihatan di area berwarna (mis. kotak Potongan)
  // tanpa mengganggu keterbacaan.
  watermarkLayer: {
    position: "absolute",
    top: -150,
    left: -150,
    right: -150,
    bottom: -150,
    flexDirection: "row",
    flexWrap: "wrap",
    alignContent: "flex-start",
    justifyContent: "center",
    transform: "rotate(-30deg)",
    opacity: 0.08,
  },
  watermarkTile: {
    width: 69,
    height: 25,
    textAlign: "center",
    fontSize: 5,
    fontWeight: 700,
    color: "#111111",
  },
});

// Ukuran per tile diperkecil (lihat watermarkTile) — jumlah tile dinaikkan
// sepadan supaya grid tetap penuh menutupi area overflow watermarkLayer
// (895x1142 setelah dibentangkan -150 tiap sisi dari A4), bukan cuma
// tersebar jarang seperti sebelumnya.
const WATERMARK_TILE_COUNT = 550;

function Watermark({ text }: { text: string }) {
  return (
    <View style={styles.watermarkLayer} fixed>
      {Array.from({ length: WATERMARK_TILE_COUNT }).map((_, i) => (
        <Text key={i} style={styles.watermarkTile}>
          {text}
        </Text>
      ))}
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoColon}>:</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function LineRow({
  label,
  amount,
  zebra,
}: {
  label: string;
  amount: number;
  zebra?: boolean;
}) {
  return (
    <View
      style={zebra ? [styles.lineRow, styles.lineRowZebra] : styles.lineRow}
    >
      <Text style={styles.lineLabel}>{label.toUpperCase()}</Text>
      <Text style={styles.lineColon}>Rp</Text>
      <Text style={styles.lineValue}>{formatRupiahOrDash(amount)}</Text>
    </View>
  );
}

function TotalRow({ label, amount }: { label: string; amount: number }) {
  return (
    <View style={styles.totalRow}>
      <Text style={styles.totalLabel}>{label}</Text>
      <Text style={styles.lineValueBold}>Rp {formatRupiah(amount)}</Text>
    </View>
  );
}

function ItemList({
  items,
  emptyLabel,
}: {
  items: PayslipPrintItem[];
  emptyLabel: string;
}) {
  if (items.length === 0) {
    return <Text style={styles.emptyLine}>{emptyLabel}</Text>;
  }
  return (
    <>
      {items.map((item, index) => (
        <LineRow
          key={index}
          label={item.name}
          amount={item.amount}
          zebra={index % 2 === 1}
        />
      ))}
    </>
  );
}

export function PayslipPdfDocument({
  doc,
  generatedBy,
  qrCodeDataUrl,
}: {
  doc: PayslipPrintDocument;
  generatedBy: string;
  qrCodeDataUrl: string;
}) {
  const pendapatanTetap = doc.items.filter(
    (i) => i.category === "PENDAPATAN_TETAP",
  );
  const pendapatanTidakTetap = doc.items.filter(
    (i) => i.category === "PENDAPATAN_TIDAK_TETAP",
  );
  const potongan = doc.items.filter((i) => i.category === "POTONGAN");
  const pinjaman = doc.items.filter((i) => i.category === "PINJAMAN");

  const bruto = pendapatanTetap.reduce((sum, i) => sum + i.amount, 0);
  const totalPotongan = potongan.reduce((sum, i) => sum + i.amount, 0);
  const totalPinjaman = pinjaman.reduce((sum, i) => sum + i.amount, 0);
  const netto = bruto - totalPotongan;

  const signatureBuffer = doc.signatureUrl
    ? localImageBuffer(doc.signatureUrl)
    : null;
  const letterheadBuffer = doc.letterheadUrl
    ? localImageBuffer(doc.letterheadUrl)
    : null;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {letterheadBuffer ? (
          <View style={styles.letterheadRow}>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <Image src={letterheadBuffer} style={styles.letterheadImage} />
          </View>
        ) : null}

        <View style={styles.outer}>
          <View style={styles.titleBar}>
            <Text style={styles.title}>BUKTI PEMBAYARAN GAJI</Text>
          </View>

          <View style={styles.body}>
            <View style={styles.headerInfoRow}>
              <View style={styles.headerInfoCol}>
                <InfoRow label="NAMA" value={doc.employeeName} />
                <InfoRow label="NIP" value={doc.employeeNumber} />
                <InfoRow label="PKT/GOL" value={doc.golongan ?? "-"} />
                <InfoRow label="STATUS" value={doc.employmentStatusName} />
              </View>
              <View style={styles.headerInfoCol}>
                <InfoRow label="BAGIAN" value={doc.departmentName} />
                <InfoRow label="JABATAN" value={doc.positionName} />
                <InfoRow label="PERIODE" value={doc.paymentDateLabel} />
              </View>
            </View>

            <View style={styles.ledgerRow}>
              <View style={styles.ledgerCol}>
                <Text style={styles.colHeaderPenerimaan}>PENERIMAAN</Text>
                <ItemList items={pendapatanTetap} emptyLabel="Tidak ada." />
                <TotalRow label="BRUTO" amount={bruto} />

                <View style={styles.sectionGap}>
                  <Text style={styles.subHeader}>PENERIMAAN LAIN :</Text>
                  <ItemList
                    items={pendapatanTidakTetap}
                    emptyLabel="Tidak ada."
                  />
                </View>
              </View>

              <View style={styles.ledgerCol}>
                <Text style={styles.colHeaderPotongan}>POTONGAN</Text>
                <ItemList items={potongan} emptyLabel="Tidak ada." />
                <TotalRow label="TOTAL POTONGAN" amount={totalPotongan} />
                <TotalRow label="NETTO" amount={netto} />

                <View style={styles.sectionGap}>
                  <Text style={styles.subHeader}>PINJAMAN :</Text>
                  <ItemList items={pinjaman} emptyLabel="Tidak ada." />
                  <TotalRow label="TOTAL PINJAMAN" amount={totalPinjaman} />
                </View>
              </View>
            </View>

            <View style={styles.finalBoxRow}>
              <View style={styles.finalBox}>
                <Text style={styles.finalBoxLabel}>PENERIMAAN</Text>
                <Text style={styles.finalBoxValue}>
                  Rp {formatRupiah(doc.netPay)}
                </Text>
              </View>
            </View>

            <View style={styles.footerRow}>
              <View style={styles.ketColumn}>
                <Text style={styles.subHeader}>KETERANGAN (DALAM HARI)</Text>
                <View style={styles.ketRow}>
                  <Text style={styles.ketLabel}>CUTI</Text>
                  <Text style={styles.ketColon}>:</Text>
                  <Text>{doc.leaveSummary.cuti}</Text>
                </View>
                <View style={styles.ketRow}>
                  <Text style={styles.ketLabel}>SAKIT (KET.DOKTER)</Text>
                  <Text style={styles.ketColon}>:</Text>
                  <Text>{doc.leaveSummary.sakit}</Text>
                </View>
                <View style={styles.ketRow}>
                  <Text style={styles.ketLabel}>DISPENSASI/SPPD</Text>
                  <Text style={styles.ketColon}>:</Text>
                  <Text>{doc.leaveSummary.dispensasiSppd}</Text>
                </View>
                <Text style={styles.footnote}>
                  *Terhitung dari tanggal {doc.periodRangeLabel}
                </Text>
              </View>

              <View style={styles.signColumn}>
                <Text style={styles.signCityDate}>{doc.cityDateLabel}</Text>
                <Text style={{ marginBottom: 4 }}>{doc.departmentName}</Text>
                <View style={styles.signSpace}>
                  {signatureBuffer ? (
                    // eslint-disable-next-line jsx-a11y/alt-text
                    <Image src={signatureBuffer} style={styles.signImage} />
                  ) : null}
                </View>
                <Text style={styles.signName}>{doc.signerName ?? "-"}</Text>
                <Text>{doc.signerTitle ?? ""}</Text>
              </View>
            </View>

            <View style={styles.slipNumberRow}>
              <View style={styles.slipNumberTextBlock}>
                <Text style={styles.slipNumberLabel}>No. Slip</Text>
                <Text style={styles.slipNumberValue}>{doc.slipNumber}</Text>
              </View>
              {/* eslint-disable-next-line jsx-a11y/alt-text */}
              <Image src={qrCodeDataUrl} style={styles.qrImage} />
            </View>
          </View>
        </View>

        <View style={styles.pageFooter} fixed>
          <Text>
            {formatPrintedAt(new Date())} · E-HRIS | BANK GRESIK · Digenerate
            oleh {generatedBy}
          </Text>
        </View>

        {doc.watermarkText ? <Watermark text={doc.watermarkText} /> : null}
      </Page>
    </Document>
  );
}







































