import { redirect } from "next/navigation"
import { Briefcase, FileBadge, FileText, FileWarning } from "lucide-react"

import { auth } from "@/auth"
import { Breadcrumb } from "@/components/breadcrumb"

const plannedModules = [
  {
    title: "Surat Keterangan Kerja",
    description: "Penerbitan surat keterangan kerja pegawai dengan format dan data yang terstandar.",
    icon: FileBadge,
  },
  {
    title: "Surat Peringatan (SP)",
    description: "Pencatatan dan penerbitan surat peringatan sesuai proses dan kewenangan yang berlaku.",
    icon: FileWarning,
  },
  {
    title: "Perjanjian Kerja",
    description: "Pengelolaan surat perjanjian kerja dan dokumen hubungan kerja lainnya.",
    icon: FileText,
  },
]

export default async function HrAdministrationPage() {
  const session = await auth()
  if (session?.user.role !== "SUPER_ADMIN") {
    redirect("/admin/dashboard")
  }

  return (
    <div>
      <Breadcrumb
        items={[
          { label: "Dashboard", href: "/admin/dashboard" },
          { label: "HR Administration" },
        ]}
      />

      <div className="mb-7 flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Briefcase className="size-5" />
        </span>
        <div>
          <h1 className="text-xl font-semibold sm:text-2xl">HR Administration</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Pusat administrasi dokumen kepegawaian. Modul penerbitan surat akan dikembangkan bertahap.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {plannedModules.map(({ title, description, icon: Icon }) => (
          <section key={title} className="rounded-xl border border-border bg-card p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <span className="flex size-10 items-center justify-center rounded-lg bg-muted text-foreground">
                <Icon className="size-5" />
              </span>
              <span className="rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground">
                Dalam pengembangan
              </span>
            </div>
            <h2 className="font-semibold">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
          </section>
        ))}
      </div>
    </div>
  )
}
