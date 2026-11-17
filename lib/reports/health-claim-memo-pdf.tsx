import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer"

import type { MemoPrintData } from "@/lib/health-claim-memo-print"
import { PDF_DOCUMENT_SIGNATURE } from "@/lib/app-signature"

// PDF Nota Dinas klaim kesehatan — tata letak mengikuti contoh Nota Dinas
// Bagian Personalia (kepala surat, tabel rincian, tanda tangan, kotak
// Disposisi Direksi).

const BORDER = "#111111"

const styles = StyleSheet.create({
  page: { paddingTop: 36, paddingHorizontal: 48, paddingBottom: 40, fontSize: 10, fontFamily: "Helvetica", color: "#111" },
  title: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    textDecoration: "underline",
    letterSpacing: 1,
  },
  number: { fontSize: 9, textAlign: "center", marginTop: 3 },
  header: { marginTop: 16, borderBottomWidth: 1, borderBottomColor: BORDER, paddingBottom: 6 },
  headerRow: { flexDirection: "row", marginBottom: 1.5 },
  headerLabel: { width: 70 },
  headerColon: { width: 10 },
  headerValue: { flex: 1 },
  paragraph: { marginTop: 12, textAlign: "justify", lineHeight: "15pt" },
  table: { marginTop: 8, borderTopWidth: 1, borderLeftWidth: 1, borderColor: BORDER },
  tr: { flexDirection: "row" },
  th: {
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: BORDER,
    paddingVertical: 3,
    paddingHorizontal: 3,
    fontFamily: "Helvetica-Bold",
    fontSize: 8.5,
    textAlign: "center",
    justifyContent: "center",
  },
  td: {
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: BORDER,
    paddingVertical: 2.5,
    paddingHorizontal: 4,
    fontSize: 9,
    justifyContent: "center",
  },
  center: { textAlign: "center" },
  right: { textAlign: "right" },
  bold: { fontFamily: "Helvetica-Bold" },
  closing: { marginTop: 10, lineHeight: "15pt", paddingHorizontal: 18 },
  signRow: { marginTop: 10, flexDirection: "row", justifyContent: "flex-end", gap: 28 },
  signBox: { width: 170, alignItems: "center" },
  signLabel: { textAlign: "center" },
  signSpace: { height: 44, width: 150, alignItems: "center", justifyContent: "center", marginVertical: 2 },
  signImage: { maxHeight: 42, maxWidth: 140, objectFit: "contain" },
  signPending: { fontSize: 7.5, color: "#888" },
  signName: { fontFamily: "Helvetica-Bold", textDecoration: "underline" },
  signDate: { fontSize: 7.5, color: "#555", marginTop: 1 },
  dispo: { marginTop: 12, borderWidth: 1, borderColor: BORDER },
  dispoTitle: {
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    textDecoration: "underline",
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderColor: BORDER,
  },
  dispoBody: { minHeight: 64, padding: 8, flexDirection: "row", gap: 10 },
  dispoText: { flex: 1, lineHeight: 1.4 },
  dispoDecision: { fontFamily: "Helvetica-Bold" },
  dispoSign: { width: 130, alignItems: "center", justifyContent: "flex-end" },
  stamp: {
    position: "absolute",
    top: 330,
    left: 0,
    right: 0,
    textAlign: "center",
    fontSize: 64,
    fontFamily: "Helvetica-Bold",
    color: "#c00000",
    opacity: 0.12,
    transform: "rotate(-30deg)",
  },
  qrBox: { marginTop: 10, flexDirection: "row", alignItems: "center", gap: 8 },
  qrImage: { width: 54, height: 54 },
  qrText: { fontSize: 7, color: "#555", lineHeight: 1.3 },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 48,
    right: 48,
    fontSize: 7,
    color: "#888",
    flexDirection: "row",
    justifyContent: "space-between",
  },
})

const COLS = [5, 20, 15, 20, 14, 26] // persen lebar kolom

function money(value: number) {
  return `Rp ${Math.round(value).toLocaleString("id-ID")},-`
}

export function HealthClaimMemoPdf({
  data,
  printedBy,
  printedAt,
  qrCodeDataUrl,
}: {
  data: MemoPrintData
  printedBy: string
  printedAt: string
  // QR verifikasi keaslian — hanya untuk Nota Dinas final.
  qrCodeDataUrl?: string | null
}) {
  const w = (i: number) => ({ width: `${COLS[i]}%` })
  return (
    <Document {...PDF_DOCUMENT_SIGNATURE} title={`Nota Dinas ${data.memoNumber}`}>
      <Page size="A4" style={styles.page}>
        {data.statusLabel ? (
          <Text style={styles.stamp} fixed>
            {data.statusLabel}
          </Text>
        ) : null}

        <Text style={styles.title}>NOTA DINAS</Text>
        {data.letterNumber ? <Text style={styles.number}>Nomor : {data.letterNumber}</Text> : null}

        <View style={styles.header}>
          {[
            ["Kepada", data.toText],
            ["Dari", data.fromText],
            ["Tanggal", data.dateLabel],
            ["Perihal", data.subject],
          ].map(([label, value]) => (
            <View key={label} style={styles.headerRow}>
              <Text style={styles.headerLabel}>{label}</Text>
              <Text style={styles.headerColon}>:</Text>
              <Text style={styles.headerValue}>{value}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.paragraph}>{data.opening}</Text>

        <View style={styles.table}>
          <View style={styles.tr}>
            <Text style={[styles.th, w(0)]}>NO</Text>
            <Text style={[styles.th, w(1)]}>Nama Pegawai</Text>
            <Text style={[styles.th, w(2)]}>{`Saldo Awal\nPer ${data.balanceDateLabel}`}</Text>
            <Text style={[styles.th, w(3)]}>Nama Pasien</Text>
            <Text style={[styles.th, w(4)]}>{"Jumlah\nKlaim"}</Text>
            <Text style={[styles.th, w(5)]}>Keterangan</Text>
          </View>
          {data.rows.map((r) => (
            <View key={r.no} style={styles.tr} wrap={false}>
              <Text style={[styles.td, styles.center, w(0)]}>{r.no}</Text>
              <Text style={[styles.td, styles.center, w(1)]}>{r.employeeName}</Text>
              <Text style={[styles.td, w(2)]}>{money(r.balance)}</Text>
              <Text style={[styles.td, styles.center, w(3)]}>{r.patient}</Text>
              <Text style={[styles.td, w(4)]}>{money(r.amount)}</Text>
              <Text style={[styles.td, w(5)]}>{r.note}</Text>
            </View>
          ))}
          <View style={styles.tr} wrap={false}>
            <Text style={[styles.td, styles.center, styles.bold, { width: `${COLS[0] + COLS[1] + COLS[2] + COLS[3]}%` }]}>
              TOTAL
            </Text>
            <Text style={[styles.td, styles.bold, { textDecoration: "underline" }, w(4)]}>{money(data.total)}</Text>
            <Text style={[styles.td, w(5)]}> </Text>
          </View>
        </View>

        {data.closing ? <Text style={styles.closing}>{data.closing}</Text> : null}

        {data.signers.length > 0 ? (
          <View style={styles.signRow} wrap={false}>
            {data.signers.map((s, i) => (
              <View key={i} style={styles.signBox}>
                <Text style={styles.signLabel}>{s.label}</Text>
                <View style={styles.signSpace}>
                  {s.signature ? (
                    // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image, bukan <img> DOM (tidak punya prop alt)
                    <Image src={s.signature} style={styles.signImage} />
                  ) : s.signed ? (
                    <Text style={styles.signPending}>Disetujui secara elektronik</Text>
                  ) : (
                    <Text style={styles.signPending}>Menunggu persetujuan</Text>
                  )}
                </View>
                <Text style={styles.signName}>{s.name.toUpperCase()}</Text>
                {s.date ? <Text style={styles.signDate}>{s.date}</Text> : null}
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.dispo} wrap={false}>
          <Text style={styles.dispoTitle}>Disposisi Direksi</Text>
          <View style={styles.dispoBody}>
            <View style={styles.dispoText}>
              {data.disposition?.decision ? (
                <>
                  <Text style={styles.dispoDecision}>{data.disposition.decision}</Text>
                  {data.disposition.note ? <Text>{data.disposition.note}</Text> : null}
                </>
              ) : (
                <Text style={styles.signPending}>
                  {data.disposition ? "Menunggu disposisi." : "Alur persetujuan tidak memuat disposisi Direksi."}
                </Text>
              )}
            </View>
            {data.disposition?.decision ? (
              <View style={styles.dispoSign}>
                {data.disposition.signature ? (
                  // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image, bukan <img> DOM (tidak punya prop alt)
                  <Image src={data.disposition.signature} style={styles.signImage} />
                ) : null}
                <Text style={[styles.bold, { fontSize: 8.5 }]}>{data.disposition.name}</Text>
                {data.disposition.date ? <Text style={styles.signDate}>{data.disposition.date}</Text> : null}
              </View>
            ) : null}
          </View>
        </View>

        {qrCodeDataUrl ? (
          <View style={styles.qrBox} wrap={false}>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image, bukan <img> DOM (tidak punya prop alt) */}
            <Image src={qrCodeDataUrl} style={styles.qrImage} />
            <Text style={styles.qrText}>
              {`Dokumen sah dari HRIS Bank Gresik.
Pindai untuk memeriksa keaslian Nota Dinas ${data.memoNumber}.`}
            </Text>
          </View>
        ) : null}

        <View style={styles.footer} fixed>
          <Text>
            {data.memoNumber} · Dicetak dari HRIS Bank Gresik oleh {printedBy} · {printedAt}
          </Text>
          <Text render={({ pageNumber, totalPages }) => `Hal. ${pageNumber}/${totalPages}`} />
        </View>
      </Page>
    </Document>
  )
}
