import {
  LayoutDashboard,
  Users,
  UserRound,
  Network,
  Briefcase,
  Building2,
  MapPin,
  Clock,
  CalendarDays,
  ShieldCheck,
  User,
  KeyRound,
  History,
  FilePlus2,
  Workflow,
  ClipboardCheck,
  Users2,
  FileBarChart,
  Fingerprint,
  CalendarOff,
  Wallet,
  Banknote,
  Rows3,
  Calculator,
  ReceiptText,
  FileBadge,
  Settings2,
  UserCog,
  FileClock,
  Activity,
  SlidersHorizontal,
  Table2,
  HeartPulse,
  DatabaseBackup,
  Save,
  Database,
  Target,
  ClipboardPenLine,
  MessageSquareWarning,
  MonitorCog,
  Gauge,
  Archive,
  BookOpen,
  LifeBuoy,
  Award,
  Stethoscope,
  Car,
  ClipboardList,
} from "lucide-react"

import type { NavEntry, NavSubItem } from "@/components/dashboard-nav"
import type { HrMenuKey } from "@/lib/hr-menu-access"

// Sidebar lengkap SUPER_ADMIN/HR_ADMIN — dipakai app/admin/layout.tsx MAUPUN
// app/pegawai/layout.tsx. Akun HR_ADMIN/SUPER_ADMIN punya identitas pegawai
// (employeeId) jadi bisa masuk ke halaman self-service di bawah /pegawai
// (form pengajuan izin per-jenis cuma ada satu implementasi, di situ) —
// tanpa fungsi bersama ini, sidebar-nya akan "menyusut" jadi versi pegawai
// biasa begitu dia pindah dari /admin/ajukan-izin ke /pegawai/ajukan-izin/xxx,
// padahal hak aksesnya tidak berubah sama sekali. Lihat riwayat percakapan
// soal ini kalau butuh konteks bug yang diperbaiki.
export function buildAdminNavItems({
  role,
  menuAccess,
  hasEmployeeIdentity,
  pendingApprovalCount = 0,
  claimReviewCount = null,
  claimPaymentCount = null,
  vehicleReviewCount = null,
}: {
  role: "SUPER_ADMIN" | "HR_ADMIN"
  menuAccess: HrMenuKey[]
  hasEmployeeIdentity: boolean
  pendingApprovalCount?: number
  // null = bukan petugas klaim kesehatan (menu Pemeriksaan Klaim disembunyikan)
  claimReviewCount?: number | null
  // null = bukan Accounting klaim (menu Pembayaran Klaim disembunyikan)
  claimPaymentCount?: number | null
  // null = bukan petugas kendaraan (menu Kelola Kendaraan disembunyikan)
  vehicleReviewCount?: number | null
}): NavEntry[] {
  function canAccess(key: HrMenuKey) {
    return role === "SUPER_ADMIN" || menuAccess.includes(key)
  }

  // Filter per sub-menu (bukan per-grup lagi) — grup cuma dimunculkan di
  // sidebar kalau minimal satu sub-menunya bisa diakses, supaya HR Admin
  // yang cuma dikasih akses ke sebagian isi grup (mis. "Data Absensi" saja
  // tanpa "Pengaturan Absensi") tidak melihat sub-menu yang bukan haknya.
  function accessibleItems(
    items: (NavSubItem & { key: HrMenuKey })[]
  ): NavSubItem[] {
    return items
      .filter((item) => canAccess(item.key))
      .map(({ key: _key, ...rest }) => rest)
  }

  const navItems: NavEntry[] = [
    {
      type: "link",
      label: "Dashboard",
      href: "/admin/dashboard",
      icon: <LayoutDashboard className="size-4 shrink-0" />,
    },
    {
      type: "link",
      label: "Profil Saya",
      href: "/admin/profil",
      icon: <User className="size-4 shrink-0" />,
    },
    ...(hasEmployeeIdentity
      ? [
          {
            // Riwayat absensi PRIBADI (beda dari grup "Absensi" di bawah,
            // yang isinya data absensi seluruh pegawai) — form pengajuan
            // per-jenis izin cuma ada satu implementasi, di bawah
            // /pegawai/*, jadi link-nya tetap ke sana.
            type: "link" as const,
            label: "Riwayat Absensi",
            href: "/pegawai/absensi",
            icon: <Fingerprint className="size-4 shrink-0" />,
          },
          {
            type: "link" as const,
            label: "Ajukan Izin",
            href: "/admin/ajukan-izin",
            icon: <FilePlus2 className="size-4 shrink-0" />,
          },
          {
            type: "link" as const,
            label: "Riwayat Izin",
            href: "/admin/riwayat-izin",
            icon: <History className="size-4 shrink-0" />,
          },
          {
            type: "link" as const,
            label: "Self Assessment",
            href: "/pegawai/self-assessment",
            icon: <ClipboardPenLine className="size-4 shrink-0" />,
          },
          {
            type: "link" as const,
            label: "Approval Center",
            href: "/admin/approval-center",
            icon: <ClipboardCheck className="size-4 shrink-0" />,
            badge: pendingApprovalCount,
          },
          {
            type: "link" as const,
            label: "Ruang Tim",
            href: "/admin/ruang-tim",
            icon: <Users2 className="size-4 shrink-0" />,
          },
          {
            type: "link" as const,
            label: "Klaim Kesehatan Saya",
            href: "/pegawai/klaim-kesehatan",
            icon: <HeartPulse className="size-4 shrink-0" />,
          },
          ...(claimReviewCount !== null
            ? [
                {
                  type: "link" as const,
                  label: "Pemeriksaan Klaim",
                  href: "/pegawai/pemeriksaan-klaim",
                  icon: <Stethoscope className="size-4 shrink-0" />,
                  badge: claimReviewCount,
                },
              ]
            : []),
          ...(claimPaymentCount !== null
            ? [
                {
                  type: "link" as const,
                  label: "Pembayaran Klaim",
                  href: "/pegawai/pembayaran-klaim",
                  icon: <Banknote className="size-4 shrink-0" />,
                  badge: claimPaymentCount,
                },
              ]
            : []),
          {
            type: "link" as const,
            label: "Pinjam Mobil",
            href: "/pegawai/kendaraan",
            icon: <Car className="size-4 shrink-0" />,
          },
          ...(vehicleReviewCount !== null
            ? [
                {
                  type: "link" as const,
                  label: "Kelola Kendaraan",
                  href: "/pegawai/kelola-kendaraan",
                  icon: <ClipboardList className="size-4 shrink-0" />,
                  badge: vehicleReviewCount,
                },
              ]
            : []),
          {
            type: "link" as const,
            label: "Perpustakaan",
            href: "/pegawai/perpustakaan",
            icon: <BookOpen className="size-4 shrink-0" />,
          },
        ]
      : []),
  ]

  navItems.push({ type: "divider" })

  const kepegawaianItems = accessibleItems([
    {
      key: "kepegawaian.pegawai",
      label: "Data Pegawai",
      href: "/admin/pegawai",
      icon: <UserRound className="size-4 shrink-0" />,
    },
    {
      key: "kepegawaian.struktur-organisasi",
      label: "Struktur Organisasi",
      href: "/admin/struktur-organisasi",
      icon: <Network className="size-4 shrink-0" />,
    },
    {
      key: "kepegawaian.jabatan",
      label: "Data Jabatan",
      href: "/admin/jabatan",
      icon: <Briefcase className="size-4 shrink-0" />,
    },
    {
      key: "kepegawaian.bagian",
      label: "Data Bagian",
      href: "/admin/bagian",
      icon: <Building2 className="size-4 shrink-0" />,
    },
    {
      key: "kepegawaian.lokasi-kerja",
      label: "Data Lokasi Kerja",
      href: "/admin/lokasi-kerja",
      icon: <MapPin className="size-4 shrink-0" />,
    },
    {
      key: "kepegawaian.jam-kerja",
      label: "Data Hari & Jam Kerja",
      href: "/admin/jam-kerja",
      icon: <Clock className="size-4 shrink-0" />,
    },
    {
      key: "kepegawaian.hari-libur",
      label: "Hari Libur Nasional",
      href: "/admin/hari-libur",
      icon: <CalendarDays className="size-4 shrink-0" />,
    },
    {
      key: "kepegawaian.saldo-cuti",
      label: "Saldo Cuti Pegawai",
      href: "/admin/saldo-cuti",
      icon: <CalendarOff className="size-4 shrink-0" />,
    },
    {
      key: "kepegawaian.sertifikasi",
      label: "Sertifikasi & Pelatihan",
      href: "/admin/sertifikasi",
      icon: <Award className="size-4 shrink-0" />,
    },
    {
      key: "kepegawaian.pengaturan",
      label: "Pengaturan Kepegawaian",
      href: "/admin/pegawai/pengaturan",
      icon: <SlidersHorizontal className="size-4 shrink-0" />,
    },
  ])
  if (kepegawaianItems.length > 0) {
    navItems.push({
      type: "group",
      label: "Kepegawaian",
      icon: <Users className="size-4 shrink-0" />,
      items: kepegawaianItems,
    })
  }

  const payrollItems = accessibleItems([
    {
      key: "payroll.komponen-gaji",
      label: "Komponen Gaji",
      href: "/admin/payroll/komponen-gaji",
      icon: <Banknote className="size-4 shrink-0" />,
    },
    {
      key: "payroll.struktur-gaji",
      label: "Struktur & Golongan Gaji",
      href: "/admin/payroll/struktur-gaji",
      icon: <Rows3 className="size-4 shrink-0" />,
    },
    {
      key: "payroll.proses",
      label: "Proses Payroll",
      href: "/admin/payroll/proses",
      icon: <Calculator className="size-4 shrink-0" />,
    },
    {
      key: "payroll.slip-gaji",
      label: "Slip Gaji Pegawai",
      href: "/admin/payroll/slip-gaji",
      icon: <ReceiptText className="size-4 shrink-0" />,
    },
    {
      key: "payroll.pajak-bpjs",
      label: "BPJS & Pajak (PPh 21)",
      href: "/admin/payroll/pajak-bpjs",
      icon: <FileBadge className="size-4 shrink-0" />,
    },
    {
      key: "payroll.klaim-kesehatan",
      label: "Klaim Kesehatan",
      href: "/admin/payroll/klaim-kesehatan",
      icon: <HeartPulse className="size-4 shrink-0" />,
    },
    {
      key: "payroll.klaim-kesehatan-pengaturan",
      label: "Pengaturan Klaim Kesehatan",
      href: "/admin/payroll/klaim-kesehatan/pengaturan",
      icon: <SlidersHorizontal className="size-4 shrink-0" />,
    },
    {
      key: "payroll.pengaturan",
      label: "Pengaturan Payroll",
      href: "/admin/payroll/pengaturan",
      icon: <Settings2 className="size-4 shrink-0" />,
    },
  ])
  if (payrollItems.length > 0) {
    navItems.push({
      type: "group",
      label: "Payroll",
      icon: <Wallet className="size-4 shrink-0" />,
      items: payrollItems,
    })
  }

  const absensiItems = accessibleItems([
    {
      key: "absensi.dashboard",
      label: "Dashboard Absensi",
      href: "/admin/absensi/dashboard",
      icon: <Gauge className="size-4 shrink-0" />,
    },
    {
      key: "absensi.data",
      label: "Data Absensi",
      href: "/admin/absensi/data",
      icon: <Table2 className="size-4 shrink-0" />,
    },
    {
      key: "absensi.pengaturan",
      label: "Pengaturan Absensi",
      href: "/admin/absensi/pengaturan",
      icon: <SlidersHorizontal className="size-4 shrink-0" />,
    },
  ])
  if (absensiItems.length > 0) {
    navItems.push({
      type: "group",
      label: "Absensi",
      icon: <Fingerprint className="size-4 shrink-0" />,
      items: absensiItems,
    })
  }

  const izinItems = accessibleItems([
    {
      key: "approval.monitoring",
      label: "Monitoring Izin",
      href: "/admin/izin/monitoring",
      icon: <Activity className="size-4 shrink-0" />,
    },
    {
      key: "approval.alur",
      label: "Alur Approval",
      href: "/admin/alur-approval",
      icon: <Workflow className="size-4 shrink-0" />,
    },
    {
      key: "approval.pengaturan",
      label: "Pengaturan Izin",
      href: "/admin/izin/pengaturan",
      icon: <SlidersHorizontal className="size-4 shrink-0" />,
    },
  ])
  if (izinItems.length > 0) {
    navItems.push({
      type: "group",
      label: "Izin",
      icon: <FileClock className="size-4 shrink-0" />,
      items: izinItems,
    })
  }

  if (canAccess("umum.kendaraan")) {
    navItems.push({
      type: "link",
      label: "Kendaraan Dinas",
      href: "/admin/kendaraan",
      icon: <Car className="size-4 shrink-0" />,
    })
  }

  if (canAccess("kpi.perhitungan")) {
    navItems.push({
      type: "link",
      label: "Perhitungan KPI",
      href: "/admin/kpi/perhitungan",
      icon: <Target className="size-4 shrink-0" />,
    })
  }

  if (role === "SUPER_ADMIN") {
    navItems.push({
      type: "link",
      label: "HR Administration",
      href: "/admin/hr-administration",
      icon: <FileBadge className="size-4 shrink-0" />,
    })
  }

  if (canAccess("laporan")) {
    navItems.push({
      type: "link",
      label: "Laporan",
      href: "/admin/laporan",
      icon: <FileBarChart className="size-4 shrink-0" />,
    })
  }

  if (canAccess("perpustakaan.kelola")) {
    navItems.push({
      type: "link",
      label: "Kelola Perpustakaan",
      href: "/admin/perpustakaan",
      icon: <BookOpen className="size-4 shrink-0" />,
    })
  }

  if (role === "SUPER_ADMIN") {
    navItems.push(
      { type: "divider" },
      {
        type: "link",
        label: "Manajemen Akses HR",
        href: "/admin/akses-hr",
        icon: <ShieldCheck className="size-4 shrink-0" />,
      },
      {
        type: "group",
        label: "Monitoring System",
        icon: <MonitorCog className="size-4 shrink-0" />,
        items: [
          {
            label: "Monitoring Dashboard",
            href: "/admin/monitoring-system/dashboard",
            icon: <Gauge className="size-4 shrink-0" />,
          },
          {
            label: "Monitoring Penyimpanan",
            href: "/admin/monitoring-system/penyimpanan",
            icon: <Database className="size-4 shrink-0" />,
          },
          {
            label: "Log Aktivitas",
            href: "/admin/log-aktivitas",
            icon: <History className="size-4 shrink-0" />,
          },
          {
            label: "Laporan Kendala",
            href: "/admin/monitoring-system/laporan-kendala",
            icon: <MessageSquareWarning className="size-4 shrink-0" />,
          },
        ],
      },
      {
        type: "link",
        label: "Manajemen Pengguna",
        href: "/admin/manajemen-pengguna",
        icon: <UserCog className="size-4 shrink-0" />,
      },
      {
        type: "link",
        label: "Kebijakan Keamanan",
        href: "/admin/keamanan/kebijakan",
        icon: <KeyRound className="size-4 shrink-0" />,
      },
      {
        type: "group",
        label: "Backup",
        icon: <DatabaseBackup className="size-4 shrink-0" />,
        items: [
          {
            label: "Backup Database",
            href: "/admin/backup/database",
            icon: <Save className="size-4 shrink-0" />,
          },
          {
            label: "Arsip Data",
            href: "/admin/backup/arsip",
            icon: <Archive className="size-4 shrink-0" />,
          },
        ],
      }
    )
  }

  navItems.push(
    { type: "divider" },
    {
      type: "link",
      label: "Pengaturan Akun",
      href: "/admin/pengaturan",
      icon: <KeyRound className="size-4 shrink-0" />,
    },
    {
      type: "link",
      label: "Pusat Bantuan",
      href: "/admin/bantuan",
      icon: <LifeBuoy className="size-4 shrink-0" />,
    }
  )

  // Ditaruh paling bawah supaya mudah ditemukan saat butuh melapor kendala.
  if (hasEmployeeIdentity) {
    navItems.push({
      type: "link",
      label: "Laporkan Kendala",
      href: "/pegawai/laporkan-kendala",
      icon: <MessageSquareWarning className="size-4 shrink-0" />,
    })
  }

  return navItems
}
