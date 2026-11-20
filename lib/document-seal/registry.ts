// Daftar jenis dokumen HRIS yang boleh meminta segel, beserta siapa yang
// membubuhkan. Tambahkan entri di sini setiap ada dokumen baru yang butuh QR
// (mis. Surat Keterangan Kerja dari modul Administrasi SDM).
//
// signerRef harus dikenal oleh Layanan Segel Dokumen:
// - STAMP     → kode stempel yang terdaftar di layanan (mis. "SDM").
// - SIGNATURE → biasanya NIP pejabat; boleh ditimpa per dokumen saat meminta.

export type DocumentSealKindValue = "SIGNATURE" | "STAMP"

export type DocumentSealType = {
  label: string
  kind: DocumentSealKindValue
  signerRef: string
  signerName: string
}

export const DOCUMENT_SEAL_TYPES = {
  PAYSLIP: { label: "Slip Gaji", kind: "STAMP", signerRef: "SDM", signerName: "Bagian SDM" },
  HEALTH_CLAIM_MEMO: { label: "Nota Dinas Klaim Kesehatan", kind: "STAMP", signerRef: "SDM", signerName: "Bagian SDM" },
} as const satisfies Record<string, DocumentSealType>

export type DocumentSealSourceType = keyof typeof DOCUMENT_SEAL_TYPES
