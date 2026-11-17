// Bagian-bagian "Berkas Pegawai" (PDF gabungan CV + lampiran) yang bisa
// dipilih saat mengunduh. Aman diimpor dari klien — tidak menyentuh DB/disk.
// Urutan di sini = urutan di PDF.

export const DOSSIER_CV_PARTS = [
  { key: "profil", label: "Profil & Data Pribadi", hint: "Kepegawaian, data pribadi, alamat, kontak" },
  { key: "keluarga", label: "Data Keluarga", hint: "Suami/istri & anak" },
  { key: "sertifikasi", label: "Sertifikasi & Pelatihan Wajib", hint: "Kewajiban & sertifikat tercatat" },
  { key: "pekerjaan", label: "Riwayat Pekerjaan", hint: "Kenaikan pangkat/gaji/jabatan" },
  { key: "pelatihan", label: "Riwayat Pendidikan & Pelatihan", hint: null },
  { key: "prestasi", label: "Prestasi", hint: null },
  { key: "reward", label: "Daftar Reward", hint: null },
  { key: "punishment", label: "Daftar Punishment", hint: null },
  { key: "mutasi", label: "Mutasi", hint: null },
  { key: "surat-tugas", label: "Surat Tugas", hint: null },
] as const

export const DOSSIER_ATTACHMENT_PARTS = [
  { key: "ktp", label: "KTP" },
  { key: "kk", label: "Kartu Keluarga" },
  { key: "npwp", label: "NPWP" },
  { key: "marital", label: "Surat Nikah / Akta Cerai" },
  { key: "akta", label: "Akta Kelahiran Anak" },
  { key: "file-sertifikat", label: "Scan Sertifikat" },
  { key: "file-pelatihan", label: "File Pelatihan" },
  { key: "file-prestasi", label: "File Prestasi" },
  { key: "file-mutasi", label: "File Mutasi" },
  { key: "file-surat-tugas", label: "File Surat Tugas" },
] as const

export type DossierCvPart = (typeof DOSSIER_CV_PARTS)[number]["key"]
export type DossierAttachmentPart = (typeof DOSSIER_ATTACHMENT_PARTS)[number]["key"]
export type DossierPart = DossierCvPart | DossierAttachmentPart

const ALL_KEYS = new Set<string>([
  ...DOSSIER_CV_PARTS.map((p) => p.key),
  ...DOSSIER_ATTACHMENT_PARTS.map((p) => p.key),
])

export function parseDossierParts(raw: string | null): Set<DossierPart> {
  const parts = new Set<DossierPart>()
  for (const key of (raw ?? "").split(",")) {
    if (ALL_KEYS.has(key)) parts.add(key as DossierPart)
  }
  return parts
}
