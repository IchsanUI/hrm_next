export const APPROVER_TYPE_LABEL = {
  ATASAN_LANGSUNG: "Atasan Langsung",
  KEPALA_DEPARTEMEN: "Kepala Departemen",
  PEGAWAI_PENGGANTI: "Pegawai Pengganti (Konfirmasi)",
  HR: "HR",
  DIREKSI: "Direksi",
  PEGAWAI_TERTENTU: "Pegawai Tertentu",
} as const

export type ApproverType = keyof typeof APPROVER_TYPE_LABEL
