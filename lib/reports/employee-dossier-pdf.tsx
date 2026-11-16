import path from "path"
import { readFileSync } from "fs"

import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer"

import type { DossierData, DossierSection, DossierTable } from "@/lib/employee-dossier"
import { PDF_DOCUMENT_SIGNATURE } from "@/lib/app-signature"

// Halaman CV "Berkas Pegawai". Footer & watermark TIDAK dirender di sini —
// ditempel belakangan oleh lib/reports/employee-dossier-merge.ts ke SEMUA
// halaman (CV + lampiran) supaya seragam dan nomor halamannya menghitung
// lampiran juga. Karena itu padding bawah halaman sengaja dilebihkan.

export type DossierAttachmentIndexRow = { no: number; title: string; pages: string }

const COLORS = {
  navy: "#172554",
  navySoft: "#eef2ff",
  border: "#cbd5e1",
  zebra: "#f8fafc",
  muted: "#64748b",
  text: "#0f172a",
}

let logoCache: Buffer | null | undefined
function logoBuffer() {
  if (logoCache === undefined) {
    try {
      logoCache = readFileSync(path.join(process.cwd(), "public", "LogoSystem.png"))
    } catch {
      logoCache = null
    }
  }
  return logoCache
}

const styles = StyleSheet.create({
  page: { paddingTop: 28, paddingHorizontal: 32, paddingBottom: 56, fontSize: 9, color: COLORS.text, fontFamily: "Helvetica" },
  runningHeader: {
    position: "absolute",
    top: 12,
    left: 32,
    right: 32,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7,
    color: COLORS.muted,
  },
  brandRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  brandLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  logo: { width: 30, height: 30, objectFit: "contain" },
  brandTitle: { fontSize: 10, fontFamily: "Helvetica-Bold", color: COLORS.navy },
  brandSub: { fontSize: 7.5, color: COLORS.muted },
  docTitle: { fontSize: 13, fontFamily: "Helvetica-Bold", color: COLORS.navy, textAlign: "right" },
  docSub: { fontSize: 7.5, color: COLORS.muted, textAlign: "right" },
  identity: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: COLORS.navy,
    borderRadius: 6,
    padding: 12,
  },
  photo: { width: 74, height: 92, borderRadius: 4, objectFit: "cover", backgroundColor: "#ffffff" },
  photoEmpty: {
    width: 74,
    height: 92,
    borderRadius: 4,
    backgroundColor: "#1e3a8a",
    alignItems: "center",
    justifyContent: "center",
  },
  photoInitial: { fontSize: 28, fontFamily: "Helvetica-Bold", color: "#ffffff" },
  identityText: { flex: 1, color: "#ffffff" },
  name: { fontSize: 16, fontFamily: "Helvetica-Bold", color: "#ffffff" },
  identityLine: { fontSize: 9, color: "#c7d2fe", marginTop: 2 },
  chipRow: { flexDirection: "row", gap: 5, marginTop: 7 },
  chip: { fontSize: 7.5, color: "#ffffff", borderWidth: 0.75, borderColor: "#6366f1", borderRadius: 8, paddingVertical: 2, paddingHorizontal: 6 },
  signBox: { width: 84, alignItems: "center" },
  signLabel: { fontSize: 6.5, color: "#c7d2fe", marginBottom: 3 },
  signImageWrap: { width: 84, height: 42, backgroundColor: "#ffffff", borderRadius: 3, alignItems: "center", justifyContent: "center" },
  signImage: { width: 78, height: 38, objectFit: "contain" },
  signEmpty: { fontSize: 6.5, color: COLORS.muted },
  section: { marginTop: 14 },
  sectionTitle: {
    fontSize: 9.5,
    fontFamily: "Helvetica-Bold",
    color: COLORS.navy,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    borderBottomWidth: 1.5,
    borderBottomColor: COLORS.navy,
    paddingBottom: 3,
    marginBottom: 6,
  },
  subTitle: { fontSize: 8, fontFamily: "Helvetica-Bold", color: COLORS.muted, marginTop: 6, marginBottom: 4 },
  fieldGrid: { flexDirection: "row", flexWrap: "wrap" },
  field: { width: "50%", flexDirection: "row", paddingVertical: 2, paddingRight: 10 },
  fieldLabel: { width: 92, color: COLORS.muted },
  fieldColon: { width: 8, color: COLORS.muted },
  fieldValue: { flex: 1, fontFamily: "Helvetica-Bold" },
  table: { borderWidth: 0.75, borderColor: COLORS.border, borderRadius: 3 },
  tr: { flexDirection: "row", borderTopWidth: 0.75, borderTopColor: COLORS.border },
  thRow: { flexDirection: "row", backgroundColor: COLORS.navySoft },
  th: { paddingVertical: 4, paddingHorizontal: 5, fontFamily: "Helvetica-Bold", fontSize: 8, color: COLORS.navy },
  td: { paddingVertical: 3.5, paddingHorizontal: 5, fontSize: 8.5 },
  empty: { fontSize: 8.5, color: COLORS.muted, fontStyle: "italic" },
  note: { fontSize: 7.5, color: COLORS.muted, marginTop: 4 },
})

function Fields({ fields }: { fields: [string, string][] }) {
  return (
    <View style={styles.fieldGrid}>
      {fields.map(([label, value]) => (
        <View key={label} style={styles.field} wrap={false}>
          <Text style={styles.fieldLabel}>{label}</Text>
          <Text style={styles.fieldColon}>:</Text>
          <Text style={styles.fieldValue}>{value}</Text>
        </View>
      ))}
    </View>
  )
}

function Table({ table }: { table: DossierTable }) {
  if (table.rows.length === 0) return <Text style={styles.empty}>{table.empty}</Text>
  return (
    <View style={styles.table}>
      <View style={styles.thRow}>
        {table.head.map((h, i) => (
          <Text key={h} style={[styles.th, { width: `${table.widths[i]}%` }]}>
            {h}
          </Text>
        ))}
      </View>
      {table.rows.map((row, r) => (
        <View key={r} style={[styles.tr, r % 2 === 1 ? { backgroundColor: COLORS.zebra } : {}]} wrap={false}>
          {row.map((cell, c) => (
            <Text key={c} style={[styles.td, { width: `${table.widths[c]}%` }]}>
              {cell}
            </Text>
          ))}
        </View>
      ))}
    </View>
  )
}

function Section({ section }: { section: DossierSection }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle} minPresenceAhead={40}>
        {section.title}
      </Text>
      {section.kind === "fields" ? <Fields fields={section.fields} /> : null}
      {section.kind === "table" ? <Table table={section.table} /> : null}
      {section.kind === "family" ? (
        <>
          {section.spouse ? <Fields fields={section.spouse} /> : <Text style={styles.empty}>Belum ada data pasangan.</Text>}
          <Text style={styles.subTitle}>Anak</Text>
          <Table table={section.children} />
        </>
      ) : null}
      {section.kind === "certifications" ? (
        <>
          {section.requirements ? (
            <>
              <Text style={styles.subTitle}>Kewajiban Jabatan</Text>
              <Table table={section.requirements} />
              <Text style={styles.subTitle}>Sertifikat Tercatat</Text>
            </>
          ) : null}
          <Table table={section.certificates} />
        </>
      ) : null}
    </View>
  )
}

function SignBox({ label, image }: { label: string; image: Buffer | null }) {
  return (
    <View style={styles.signBox}>
      <Text style={styles.signLabel}>{label}</Text>
      <View style={styles.signImageWrap}>
        {image ? (
          // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image, bukan <img> DOM (tidak punya prop alt)
          <Image src={image} style={styles.signImage} />
        ) : (
          <Text style={styles.signEmpty}>Tidak ada</Text>
        )}
      </View>
    </View>
  )
}

export function EmployeeDossierPdf({
  data,
  attachmentIndex,
  printedAt,
}: {
  data: DossierData
  attachmentIndex: DossierAttachmentIndexRow[]
  printedAt: string
}) {
  const logo = logoBuffer()
  return (
    <Document {...PDF_DOCUMENT_SIGNATURE} title={`Berkas Pegawai — ${data.fullName}`}>
      <Page size="A4" style={styles.page}>
        <View
          style={styles.runningHeader}
          fixed
          render={({ pageNumber }) =>
            pageNumber > 1 ? (
              <>
                <Text>Berkas Pegawai · {data.fullName} · NIP {data.employeeNumber}</Text>
                <Text>HRIS Bank Gresik</Text>
              </>
            ) : null
          }
        />

        <View style={styles.brandRow}>
          <View style={styles.brandLeft}>
            {logo ? (
              // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image, bukan <img> DOM (tidak punya prop alt)
              <Image src={logo} style={styles.logo} />
            ) : null}
            <View>
              <Text style={styles.brandTitle}>HRIS · Perumda BPR Bank Gresik</Text>
              <Text style={styles.brandSub}>Human Resource Information System</Text>
            </View>
          </View>
          <View>
            <Text style={styles.docTitle}>DAFTAR RIWAYAT HIDUP PEGAWAI</Text>
            <Text style={styles.docSub}>Dicetak {printedAt}</Text>
          </View>
        </View>

        <View style={styles.identity} wrap={false}>
          {data.photo ? (
            // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image, bukan <img> DOM (tidak punya prop alt)
            <Image src={data.photo} style={styles.photo} />
          ) : (
            <View style={styles.photoEmpty}>
              <Text style={styles.photoInitial}>{data.fullName.slice(0, 1).toUpperCase()}</Text>
            </View>
          )}
          <View style={styles.identityText}>
            <Text style={styles.name}>{data.fullName}</Text>
            <Text style={styles.identityLine}>
              {data.position} · {data.department}
            </Text>
            <Text style={styles.identityLine}>NIP {data.employeeNumber}</Text>
            <View style={styles.chipRow}>
              <Text style={styles.chip}>{data.employmentStatus}</Text>
              <Text style={styles.chip}>{data.isActive ? "Aktif" : "Nonaktif"}</Text>
            </View>
          </View>
          <View style={{ gap: 6 }}>
            <SignBox label="Tanda Tangan" image={data.signature} />
            <SignBox label="Paraf" image={data.initials} />
          </View>
        </View>

        {data.sections.map((section) => (
          <Section key={section.title} section={section} />
        ))}

        {attachmentIndex.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle} minPresenceAhead={40}>
              Daftar Lampiran
            </Text>
            <Table
              table={{
                head: ["No", "Dokumen", "Halaman"],
                widths: [8, 74, 18],
                rows: attachmentIndex.map((a) => [String(a.no), a.title, a.pages]),
                empty: "",
              }}
            />
            <Text style={styles.note}>
              Lampiran disertakan utuh sesuai file aslinya; nomor halaman mengacu pada berkas ini.
            </Text>
          </View>
        ) : null}
      </Page>
    </Document>
  )
}
