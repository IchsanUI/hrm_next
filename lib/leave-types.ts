import {
  Clock,
  LogOut,
  CalendarOff,
  Stethoscope,
  Briefcase,
  AlertTriangle,
  Baby,
  Hourglass,
  UserX,
  Landmark,
  HeartHandshake,
  type LucideIcon,
} from "lucide-react"

export type LeaveTypeOption = {
  value: string
  label: string
  description: string
  icon: LucideIcon
  href?: string // kalau ada, form-nya sudah aktif — kalau tidak, masih blueprint (toast stub)
}

export const LEAVE_TYPES: LeaveTypeOption[] = [
  {
    value: "IZIN_LEMBUR",
    label: "Izin Lembur",
    description: "Pengajuan kerja di luar jam kerja (rencana → laporan detail setelah selesai)",
    icon: Clock,
    href: "/pegawai/ajukan-izin/lembur",
  },
  {
    value: "IZIN_MENINGGALKAN_KANTOR",
    label: "Izin Meninggalkan Kantor",
    description: "Keluar kantor sementara saat jam kerja (pribadi / dinas)",
    icon: LogOut,
    href: "/pegawai/ajukan-izin/meninggalkan-kantor",
  },
  {
    value: "IZIN_CUTI",
    label: "Izin Cuti",
    description: "Cuti tahunan",
    icon: CalendarOff,
  },
  {
    value: "IZIN_SAKIT",
    label: "Izin Sakit",
    description: "Tidak masuk karena sakit (wajib surat dokter)",
    icon: Stethoscope,
    href: "/pegawai/ajukan-izin/sakit",
  },
  {
    value: "IZIN_PULANG_CEPAT",
    label: "Izin Pulang Cepat",
    description: "Pulang sebelum jam kerja berakhir",
    icon: Briefcase,
    href: "/pegawai/ajukan-izin/pulang-cepat",
  },
  {
    value: "IZIN_TERLAMBAT",
    label: "Izin Terlambat",
    description: "Real-time saat terlambat masuk kerja (wajib foto bukti)",
    icon: AlertTriangle,
    href: "/pegawai/ajukan-izin/terlambat",
  },
  {
    value: "CUTI_BERSALIN",
    label: "Cuti Bersalin / Gugur Kandungan",
    description: "Cuti melahirkan atau gugur kandungan (wajib surat dokter)",
    icon: Baby,
  },
  {
    value: "CUTI_BESAR",
    label: "Cuti Besar",
    description: "2 bulan, untuk pegawai masa kerja ≥6 tahun terus-menerus",
    icon: Hourglass,
  },
  {
    value: "CUTI_DI_LUAR_TANGGUNGAN",
    label: "Cuti Di Luar Tanggungan Perusahaan",
    description: "Maks. 3 bulan tanpa gaji, untuk pegawai masa kerja ≥10 tahun",
    icon: UserX,
  },
  {
    value: "CUTI_KHUSUS_HAJI_UMROH",
    label: "Cuti Khusus (Haji/Umroh)",
    description: "Ibadah Haji/Umroh, gaji penuh, 1x seumur bekerja per jenis",
    icon: Landmark,
  },
  {
    value: "DISPENSASI",
    label: "Dispensasi",
    description: "Kejadian khusus (nikah, keluarga meninggal, dll.) — gaji penuh, tidak potong cuti",
    icon: HeartHandshake,
  },
]
