import { Bell, type LucideIcon } from "lucide-react"

import { LEAVE_TYPES } from "@/lib/leave-types"

// Notifikasi cuma nyimpen title/message polos (tidak ada field "jenis izin"
// terpisah), jadi ikonnya ditebak dari kata kunci di judul, lalu dipetakan ke
// ikon yang sama persis dengan yang dipakai di halaman Ajukan Izin — biar
// konsisten. Urutan penting: cek frasa yang lebih spesifik duluan.
const KEYWORD_TO_LEAVE_TYPE: { keyword: string; value: string }[] = [
  { keyword: "Meninggalkan Kantor", value: "IZIN_MENINGGALKAN_KANTOR" },
  { keyword: "Pulang Cepat", value: "IZIN_PULANG_CEPAT" },
  { keyword: "Terlambat", value: "IZIN_TERLAMBAT" },
  { keyword: "Lembur", value: "IZIN_LEMBUR" },
  { keyword: "Sakit", value: "IZIN_SAKIT" },
  { keyword: "Pengganti", value: "IZIN_SAKIT" }, // notifikasi pegawai pengganti tidak selalu menyebut "Sakit"
]

export function getNotificationIcon(title: string): LucideIcon {
  const match = KEYWORD_TO_LEAVE_TYPE.find((k) => title.includes(k.keyword))
  const leaveType = match ? LEAVE_TYPES.find((t) => t.value === match.value) : undefined
  return leaveType?.icon ?? Bell
}
