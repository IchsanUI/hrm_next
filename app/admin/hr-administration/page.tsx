import { redirect } from "next/navigation"
import {
  Award,
  BadgeCheck,
  Briefcase,
  CheckCircle2,
  FileBadge,
  FileSignature,
  FileText,
  FileWarning,
  Hash,
  Layers,
  LogOut,
  Plane,
  QrCode,
  Route,
  Stamp,
  type LucideIcon,
} from "lucide-react"

import { auth } from "@/auth"
import { Breadcrumb } from "@/components/breadcrumb"
import { cn } from "@/lib/utils"

// Halaman peta modul Administrasi SDM. Belum ada fungsi: hanya menampilkan
// rencana pengembangan (lihat docs/prd-hr-administration.md).

type Module = {
  title: string
  description: string
  icon: LucideIcon
  features: string[]
  forEmployee?: string
}

const FOUNDATION: { icon: LucideIcon; label: string; detail: string }[] = [
  { icon: FileText, label: "Template surat", detail: "Isian otomatis dari data pegawai + pratinjau" },
  { icon: Hash, label: "Penomoran otomatis", detail: "Per jenis surat per tahun, tidak pernah dipakai ulang" },
  { icon: Route, label: "Alur persetujuan", detail: "Bertingkat, bisa dikembalikan atau ditolak" },
  { icon: QrCode, label: "Arsip PDF + QR", detail: "PDF final + QR TTD/stempel dari Layanan Segel Dokumen" },
]

const PHASES: { phase: number; title: string; reason: string; modules: Module[] }[] = [
  {
    phase: 1,
    title: "Fondasi & Surat Keterangan",
    reason: "Paling sering diminta pegawai dan risikonya rendah, cocok untuk menguji fondasi.",
    modules: [
      {
        title: "Surat Keterangan Kerja",
        description: "Surat keterangan masih bekerja, untuk KPR, visa, beasiswa, dan keperluan lain.",
        icon: FileBadge,
        features: [
          "Diajukan pegawai sendiri atau dibuat HR",
          "Varian dengan/tanpa keterangan penghasilan",
          "Terbit sebagai PDF bernomor dengan QR verifikasi",
        ],
        forEmployee: "Ajukan & unduh di menu Dokumen Saya",
      },
    ],
  },
  {
    phase: 2,
    title: "Surat Peringatan",
    reason: "Butuh template yang disetujui Legal dan kerahasiaan yang sudah teruji.",
    modules: [
      {
        title: "Surat Peringatan (SP)",
        description: "Teguran tertulis SP 1–3 sesuai Peraturan Perusahaan, dengan masa berlaku.",
        icon: FileWarning,
        features: [
          "Saran tingkat SP berikutnya dari SP yang masih aktif",
          "Masa berlaku & status kedaluwarsa otomatis",
          "Tanda terima dan tanggapan pegawai",
          "Akses rahasia: hanya HR, penyetuju, dan pegawai ybs.",
        ],
        forEmployee: "Konfirmasi terima & beri tanggapan",
      },
    ],
  },
  {
    phase: 3,
    title: "Perjanjian Kerja",
    reason: "Paling kompleks karena menyentuh data gaji dan status kepegawaian.",
    modules: [
      {
        title: "Perjanjian Kerja (PKWT / PKWTT)",
        description: "Kontrak kerja, perpanjangan, dan pengangkatan pegawai tetap.",
        icon: FileSignature,
        features: [
          "Hitung total masa PKWT & peringatan batas maksimal",
          "Pengingat kontrak yang akan berakhir",
          "Unggah pindaian kontrak bertanda tangan",
          "Sinkron status & tanggal kontrak ke data pegawai",
        ],
      },
    ],
  },
]

// Usulan lanjutan: belum masuk PRD, menunggu keputusan.
const PROPOSED: Module[] = [
  {
    title: "SK Mutasi, Promosi & Demosi",
    description: "Surat keputusan perpindahan jabatan/lokasi yang langsung memperbarui riwayat pegawai.",
    icon: Stamp,
    features: ["Otomatis tercatat di riwayat mutasi", "Tanggal efektif mengubah jabatan & lokasi"],
  },
  {
    title: "Surat Tugas & Perjalanan Dinas",
    description: "Surat tugas dan SPPD, terhubung dengan izin dinas luar dan Pinjam Mobil.",
    icon: Plane,
    features: ["Nomor surat & daftar peserta", "Rekap uang harian / biaya perjalanan"],
  },
  {
    title: "Penghargaan & Masa Kerja",
    description: "Piagam penghargaan dan pengingat masa kerja 5/10/15/20/25 tahun.",
    icon: Award,
    features: ["Daftar pegawai yang mencapai masa kerja", "Cetak piagam dari template"],
  },
  {
    title: "Offboarding & Paklaring",
    description: "Proses keluar pegawai: checklist pengembalian aset, nonaktif akun, dan surat pengalaman kerja.",
    icon: LogOut,
    features: ["Checklist serah-terima (laptop, kunci, ID card)", "Paklaring otomatis dari riwayat"],
  },
]

export default async function HrAdministrationPage() {
  const session = await auth()
  if (session?.user.role !== "SUPER_ADMIN") {
    redirect("/admin/dashboard")
  }

  return (
    <div>
      <Breadcrumb items={[{ label: "Dashboard", href: "/admin/dashboard" }, { label: "Administrasi SDM" }]} />

      <div className="mb-6 flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Briefcase className="size-5" />
        </span>
        <div>
          <h1 className="text-xl font-semibold sm:text-2xl">Administrasi SDM</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Pusat penerbitan dan arsip surat kepegawaian. Modul di bawah ini sedang direncanakan dan akan dirilis bertahap.
          </p>
        </div>
      </div>

      {/* Fondasi bersama */}
      <section className="mb-8 rounded-2xl border bg-card p-4 sm:p-5">
        <div className="mb-4 flex items-center gap-2">
          <Layers className="size-4 text-primary" />
          <h2 className="text-sm font-semibold">Fondasi bersama semua surat</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {FOUNDATION.map(({ icon: Icon, label, detail }) => (
            <div key={label} className="flex items-start gap-3 rounded-xl bg-muted/50 p-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-background text-primary shadow-xs">
                <Icon className="size-4" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium">{label}</p>
                <p className="text-xs text-muted-foreground">{detail}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Tahapan */}
      <h2 className="mb-3 text-sm font-semibold tracking-wide text-muted-foreground uppercase">Rencana rilis</h2>
      <ol className="relative mb-10 grid gap-5 before:absolute before:top-2 before:bottom-2 before:left-4 before:w-px before:bg-border sm:before:left-5">
        {PHASES.map((p) => (
          <li key={p.phase} className="relative grid gap-3 pl-11 sm:pl-14">
            <span className="absolute top-0 left-0 flex size-8 items-center justify-center rounded-full border-2 border-primary bg-background text-sm font-semibold text-primary sm:size-10">
              {p.phase}
            </span>
            <div>
              <p className="font-semibold">
                Tahap {p.phase} · {p.title}
              </p>
              <p className="text-xs text-muted-foreground">{p.reason}</p>
            </div>
            {p.modules.map((m) => (
              <ModuleCard key={m.title} module={m} badge="Direncanakan" />
            ))}
          </li>
        ))}
      </ol>

      {/* Usulan */}
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">Usulan modul lanjutan</h2>
        <p className="text-xs text-muted-foreground">Belum masuk PRD, menunggu keputusan.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {PROPOSED.map((m) => (
          <ModuleCard key={m.title} module={m} badge="Usulan" muted />
        ))}
      </div>
    </div>
  )
}

function ModuleCard({ module: m, badge, muted }: { module: Module; badge: string; muted?: boolean }) {
  const Icon = m.icon
  return (
    <section className={cn("rounded-2xl border bg-card p-4 sm:p-5", muted && "border-dashed")}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-xl",
              muted ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"
            )}
          >
            <Icon className="size-5" />
          </span>
          <div className="min-w-0">
            <h3 className="font-semibold">{m.title}</h3>
            <p className="mt-0.5 text-sm text-muted-foreground">{m.description}</p>
          </div>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium",
            muted ? "border text-muted-foreground" : "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
          )}
        >
          {badge}
        </span>
      </div>
      <ul className="grid gap-1.5 text-sm sm:grid-cols-2">
        {m.features.map((f) => (
          <li key={f} className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
            <span>{f}</span>
          </li>
        ))}
      </ul>
      {m.forEmployee ? (
        <p className="mt-3 flex items-center gap-1.5 rounded-lg bg-muted/60 px-2.5 py-1.5 text-xs text-muted-foreground">
          <BadgeCheck className="size-3.5 shrink-0 text-primary" />
          Untuk pegawai: {m.forEmployee}
        </p>
      ) : null}
    </section>
  )
}
