import { redirect } from "next/navigation"
import {
  LayoutDashboard,
  UserRound,
  KeyRound,
  FilePlus2,
  History,
  ClipboardCheck,
  Users2,
  Fingerprint,
  HeartPulse,
  ReceiptText,
  ClipboardPenLine,
  MessageSquareWarning,
  BookOpen,
  LifeBuoy,
  Stethoscope,
  Banknote,
  Car,
  ClipboardList,
} from "lucide-react"

import { auth } from "@/auth"
import { DashboardShell } from "@/components/dashboard-shell"
import { LocationPermissionPrompt } from "@/components/location-permission-prompt"
import { PwaInstallBanner } from "@/components/pwa-install-banner"
import type { NavEntry } from "@/components/dashboard-nav"
import { buildAdminNavItems } from "@/lib/admin-nav-items"
import { getPendingApprovalCount } from "@/lib/approval-queue"
import { getAccountingBadge, getClaimReviewerBadge } from "@/lib/health-claim"
import { getVehicleReviewBadge } from "@/lib/vehicle-booking"

function buildEmployeeNavItems(
  pendingApprovalCount: number,
  claimReviewCount: number | null,
  claimPaymentCount: number | null,
  vehicleReviewCount: number | null
): NavEntry[] {
  return [
    {
      type: "link",
      label: "Dashboard",
      href: "/pegawai/dashboard",
      icon: <LayoutDashboard className="size-4 shrink-0" />,
    },
    {
      type: "link",
      label: "Profil Saya",
      href: "/pegawai/profil",
      icon: <UserRound className="size-4 shrink-0" />,
    },
    {
      type: "link",
      label: "Riwayat Absensi",
      href: "/pegawai/absensi",
      icon: <Fingerprint className="size-4 shrink-0" />,
    },
    {
      type: "link",
      label: "Ajukan Izin",
      href: "/pegawai/ajukan-izin",
      icon: <FilePlus2 className="size-4 shrink-0" />,
    },
    {
      type: "link",
      label: "Riwayat Izin",
      href: "/pegawai/riwayat-izin",
      icon: <History className="size-4 shrink-0" />,
    },
    {
      type: "link",
      label: "Klaim Kesehatan",
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
      type: "link",
      label: "Slip Gaji",
      href: "/pegawai/slip-gaji",
      icon: <ReceiptText className="size-4 shrink-0" />,
    },
    {
      type: "link",
      label: "Self Assessment",
      href: "/pegawai/self-assessment",
      icon: <ClipboardPenLine className="size-4 shrink-0" />,
    },
    {
      type: "link",
      label: "Approval Center",
      href: "/pegawai/approval-center",
      icon: <ClipboardCheck className="size-4 shrink-0" />,
      badge: pendingApprovalCount,
    },
    {
      type: "link",
      label: "Ruang Tim",
      href: "/pegawai/ruang-tim",
      icon: <Users2 className="size-4 shrink-0" />,
    },
    {
      type: "link",
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
      type: "link",
      label: "Perpustakaan",
      href: "/pegawai/perpustakaan",
      icon: <BookOpen className="size-4 shrink-0" />,
    },
    {
      type: "link",
      label: "Pengaturan Akun",
      href: "/pegawai/pengaturan",
      icon: <KeyRound className="size-4 shrink-0" />,
    },
    {
      type: "link",
      label: "Aktivitas Login",
      href: "/pegawai/aktivitas-login",
      icon: <History className="size-4 shrink-0" />,
    },
    {
      type: "link",
      label: "Pusat Bantuan",
      href: "/pegawai/bantuan",
      icon: <LifeBuoy className="size-4 shrink-0" />,
    },
    {
      type: "link",
      label: "Laporkan Kendala",
      href: "/pegawai/laporkan-kendala",
      icon: <MessageSquareWarning className="size-4 shrink-0" />,
    },
  ]
}

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  HR_ADMIN: "HR Admin",
  EMPLOYEE: "Pegawai",
}

export default async function EmployeeLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  // Akses /pegawai/** berdasarkan "punya data pegawai" (employeeId), bukan
  // role — HR_ADMIN tetap pegawai sungguhan dan berhak akses self-service
  // miliknya sendiri (profil, ajukan izin, dst).
  if (!session?.user) {
    redirect("/login")
  }
  if (!session.user.employeeId) {
    redirect("/admin/dashboard")
  }

  const role = session.user.role
  const [pendingApprovalCount, claimReviewCount, claimPaymentCount, vehicleReviewCount] = await Promise.all([
    getPendingApprovalCount(session.user.employeeId),
    getClaimReviewerBadge(session.user.employeeId),
    getAccountingBadge(session.user.employeeId),
    getVehicleReviewBadge(session.user.employeeId),
  ])
  // HR_ADMIN/SUPER_ADMIN yang lagi berada di halaman self-service (mis. isi
  // form Ajukan Izin, yang cuma ada satu implementasi di bawah /pegawai/*)
  // tetap melihat sidebar admin LENGKAP yang sama seperti di /admin — bukan
  // sidebar pegawai yang lebih sederhana. Tanpa ini, sidebar-nya kelihatan
  // "menyusut"/berubah-ubah tiap kali dia pindah antara /admin/* dan
  // /pegawai/*, padahal hak aksesnya tidak pernah berubah.
  const navItems =
    role === "SUPER_ADMIN" || role === "HR_ADMIN"
      ? buildAdminNavItems({
          role,
          menuAccess: session.user.menuAccess,
          hasEmployeeIdentity: true,
          pendingApprovalCount,
          claimReviewCount,
          claimPaymentCount,
          vehicleReviewCount,
        })
      : buildEmployeeNavItems(pendingApprovalCount, claimReviewCount, claimPaymentCount, vehicleReviewCount)

  return (
    <DashboardShell
      username={session.user.username}
      roleLabel={ROLE_LABEL[role] ?? "Pegawai"}
      profileHref="/pegawai/profil"
      navItems={navItems}
      basePath="/pegawai"
      floating={<LocationPermissionPrompt />}
      banner={<PwaInstallBanner />}
    >
      {children}
    </DashboardShell>
  )
}
