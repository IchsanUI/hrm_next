// Grup data yang BOLEH diperbarui pegawai sendiri (Update Mandiri). Admin
// memilih grup mana yang dibuka per pegawai (Employee.selfUpdateGroups) saat
// mengaktifkan izin di Data Pegawai.
//
// SENGAJA TIDAK termasuk (selalu lewat HR): nama, NIP, NIK, tempat/tanggal
// lahir, jenis kelamin, status nikah, No NPWP & PTKP (berdampak pajak),
// jabatan/bagian/lokasi/status/kontrak/golongan/jam kerja/PIN absensi, TTD,
// paraf, sidik jari (dipakai di dokumen resmi & absensi), data keluarga
// (berdampak PTKP & plafon klaim kesehatan), dan riwayat kepegawaian.

export type SelfUpdateTextField = {
  name:
    | "phone"
    | "email"
    | "emergencyPhone"
    | "address"
    | "ktpAddress"
    | "domicileKtp"
    | "instagram"
    | "tiktok"
    | "facebook"
    | "fatherName"
    | "motherName"
    | "hobby"
    | "illness"
    | "sideBusiness"
    | "lastEducation"
    | "major"
    | "degree"
    | "bankName"
    | "bankAccountNumber"
    | "bankAccountHolder"
  label: string
  required?: boolean
  multiline?: boolean
  type?: "email" | "tel"
  maxLength?: number
}

export type SelfUpdateGroup = {
  key: string
  label: string
  description: string
  kind: "fields" | "photo" | "documents"
  fields: SelfUpdateTextField[]
}

export const SELF_UPDATE_GROUPS = [
  {
    key: "kontak",
    label: "Kontak",
    description: "No HP, email, no HP urgent",
    kind: "fields",
    fields: [
      { name: "phone", label: "No HP", required: true, type: "tel", maxLength: 30 },
      { name: "email", label: "Email", required: true, type: "email", maxLength: 150 },
      { name: "emergencyPhone", label: "No HP Urgent", type: "tel", maxLength: 30 },
    ],
  },
  {
    key: "alamat",
    label: "Alamat",
    description: "Alamat domisili, alamat & domisili KTP",
    kind: "fields",
    fields: [
      { name: "address", label: "Alamat Domisili", required: true, multiline: true, maxLength: 255 },
      { name: "ktpAddress", label: "Alamat KTP", multiline: true, maxLength: 1000 },
      { name: "domicileKtp", label: "Domisili KTP", multiline: true, maxLength: 1000 },
    ],
  },
  {
    key: "sosmed",
    label: "Media Sosial",
    description: "Instagram, TikTok, Facebook",
    kind: "fields",
    fields: [
      { name: "instagram", label: "Instagram", maxLength: 100 },
      { name: "tiktok", label: "TikTok", maxLength: 100 },
      { name: "facebook", label: "Facebook", maxLength: 100 },
    ],
  },
  {
    key: "pribadi",
    label: "Data Pribadi Tambahan",
    description: "Nama orang tua, hobi, penyakit bawaan, usaha sampingan",
    kind: "fields",
    fields: [
      { name: "fatherName", label: "Nama Ayah Kandung", maxLength: 150 },
      { name: "motherName", label: "Nama Ibu Kandung", maxLength: 150 },
      { name: "hobby", label: "Hobi", maxLength: 150 },
      { name: "illness", label: "Penyakit Bawaan", multiline: true, maxLength: 1000 },
      { name: "sideBusiness", label: "Usaha di Luar Pekerjaan", multiline: true, maxLength: 1000 },
    ],
  },
  {
    key: "pendidikan",
    label: "Pendidikan",
    description: "Pendidikan terakhir, jurusan, gelar",
    kind: "fields",
    fields: [
      { name: "lastEducation", label: "Pendidikan Terakhir", maxLength: 100 },
      { name: "major", label: "Jurusan", maxLength: 150 },
      { name: "degree", label: "Gelar", maxLength: 50 },
    ],
  },
  {
    key: "rekening",
    label: "Rekening Bank",
    description: "Nama bank, no rekening, atas nama",
    kind: "fields",
    fields: [
      { name: "bankName", label: "Nama Bank", maxLength: 100 },
      { name: "bankAccountNumber", label: "No Rekening", maxLength: 50 },
      { name: "bankAccountHolder", label: "Atas Nama", maxLength: 150 },
    ],
  },
  {
    key: "pasfoto",
    label: "Pas Foto",
    description: "Foto pegawai resmi",
    kind: "photo",
    fields: [],
  },
  {
    key: "dokumen",
    label: "Dokumen Identitas",
    description: "Scan KTP, KK, NPWP, Surat Nikah/Akta Cerai",
    kind: "documents",
    fields: [],
  },
] as const satisfies readonly SelfUpdateGroup[]

export type SelfUpdateGroupKey = (typeof SELF_UPDATE_GROUPS)[number]["key"]

export const SELF_UPDATE_GROUP_KEYS = SELF_UPDATE_GROUPS.map((g) => g.key) as SelfUpdateGroupKey[]

// Grup bawaan saat admin mengaktifkan tanpa memilih — sama dengan cakupan
// Update Mandiri versi lama (kontak, alamat, media sosial).
export const DEFAULT_SELF_UPDATE_GROUPS: SelfUpdateGroupKey[] = ["kontak", "alamat", "sosmed"]

export const SELF_UPDATE_TEXT_FIELD_NAMES: SelfUpdateTextField["name"][] = SELF_UPDATE_GROUPS.flatMap((g) =>
  (g.fields as readonly SelfUpdateTextField[]).map((f) => f.name)
)

export function parseSelfUpdateGroups(value: unknown): SelfUpdateGroupKey[] {
  if (!Array.isArray(value)) return []
  return value.filter((v): v is SelfUpdateGroupKey => SELF_UPDATE_GROUP_KEYS.includes(v as SelfUpdateGroupKey))
}

export function selfUpdateGroupLabels(keys: SelfUpdateGroupKey[]) {
  return SELF_UPDATE_GROUPS.filter((g) => keys.includes(g.key)).map((g) => g.label)
}
