import { redirect } from "next/navigation"
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
  Settings,
  History,
  FilePlus2,
  Workflow,
  ClipboardCheck,
  FileBarChart,
  Fingerprint,
} from "lucide-react"

import { auth } from "@/auth"
import { DashboardShell } from "@/components/dashboard-shell"
import type { NavEntry } from "@/components/dashboard-nav"

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  HR_ADMIN: "HR Admin",
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  const role = session?.user.role
  const isAdminRole = role === "SUPER_ADMIN" || role === "HR_ADMIN"
  if (!session?.user || !isAdminRole) {
    redirect("/login")
  }

  // Ajukan Izin/Riwayat Izin cuma relevan buat akun yang benar-benar terhubung
  // ke data pegawai (EMPLOYEE atau HR_ADMIN). Akun sistem murni (SUPER_ADMIN
  // tanpa employeeId) tidak punya identitas pegawai untuk mengajukan izin.
  const hasEmployeeIdentity = Boolean(session.user.employeeId)

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
        ]
      : []),
    {
      type: "group",
      label: "Kepegawaian",
      icon: <Users className="size-4 shrink-0" />,
      items: [
        {
          label: "Data Pegawai",
          href: "/admin/pegawai",
          icon: <UserRound className="size-4 shrink-0" />,
        },
        {
          label: "Struktur Organisasi",
          href: "/admin/struktur-organisasi",
          icon: <Network className="size-4 shrink-0" />,
        },
        {
          label: "Data Jabatan",
          href: "/admin/jabatan",
          icon: <Briefcase className="size-4 shrink-0" />,
        },
        {
          label: "Data Bagian",
          href: "/admin/bagian",
          icon: <Building2 className="size-4 shrink-0" />,
        },
        {
          label: "Data Lokasi Kerja",
          href: "/admin/lokasi-kerja",
          icon: <MapPin className="size-4 shrink-0" />,
        },
        {
          label: "Data Jam Kerja",
          href: "/admin/jam-kerja",
          icon: <Clock className="size-4 shrink-0" />,
        },
        {
          label: "Hari Libur Nasional",
          href: "/admin/hari-libur",
          icon: <CalendarDays className="size-4 shrink-0" />,
        },
      ],
    },
  ]

  navItems.push({
    type: "link",
    label: "Absensi",
    href: "/admin/absensi",
    icon: <Fingerprint className="size-4 shrink-0" />,
  })

  navItems.push({
    type: "group",
    label: "Approval",
    icon: <Workflow className="size-4 shrink-0" />,
    items: [
      {
        label: "Approval Center",
        href: "/admin/approval-center",
        icon: <ClipboardCheck className="size-4 shrink-0" />,
      },
      {
        label: "Alur Approval",
        href: "/admin/alur-approval",
        icon: <Workflow className="size-4 shrink-0" />,
      },
    ],
  })

  if (role === "SUPER_ADMIN") {
    navItems.push({
      type: "group",
      label: "Administrasi Sistem",
      icon: <ShieldCheck className="size-4 shrink-0" />,
      items: [
        {
          label: "Manajemen Akses HR",
          href: "/admin/akses-hr",
          icon: <ShieldCheck className="size-4 shrink-0" />,
        },
        {
          label: "Log Aktivitas",
          href: "/admin/log-aktivitas",
          icon: <History className="size-4 shrink-0" />,
        },
      ],
    })
  }

  navItems.push({
    type: "link",
    label: "Laporan",
    href: "/admin/laporan",
    icon: <FileBarChart className="size-4 shrink-0" />,
  })

  navItems.push({
    type: "link",
    label: "Peraturan",
    href: "/admin/pengaturan",
    icon: <Settings className="size-4 shrink-0" />,
  })

  return (
    <DashboardShell
      username={session.user.username}
      roleLabel={ROLE_LABEL[role] ?? "Admin"}
      profileHref="/admin/profil"
      navItems={navItems}
    >
      {children}
    </DashboardShell>
  )
}
