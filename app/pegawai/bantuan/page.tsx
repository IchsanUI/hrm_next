import { LifeBuoy } from "lucide-react"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { faqTopicsFor, type FaqStaffRole } from "@/lib/faq-content"
import { Breadcrumb } from "@/components/breadcrumb"
import { FaqBrowser } from "@/components/faq-browser"

export default async function BantuanPegawaiPage() {
  // Admin yang membuka versi pegawai tetap hanya melihat topik pegawai di
  // sini (panduan admin ada di /admin/bantuan), ditambah topik Petugas &
  // Sopir bila pegawai ini memegang peran tersebut.
  const session = await auth()
  const employeeId = session?.user.employeeId
  const staff = employeeId
    ? await prisma.vehicleStaff.findMany({ where: { employeeId }, select: { role: true } })
    : []
  const staffRoles: FaqStaffRole[] = staff.map((s) => (s.role === "PETUGAS" ? "vehiclePetugas" : "vehicleSopir"))
  const topics = faqTopicsFor("EMPLOYEE", staffRoles)

  return (
    <div>
      <Breadcrumb items={[{ label: "Dashboard", href: "/pegawai/dashboard" }, { label: "Pusat Bantuan" }]} />
      <div className="mb-6 flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <LifeBuoy className="size-5" />
        </span>
        <div>
          <h1 className="text-xl font-semibold sm:text-2xl">Pusat Bantuan</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Jawaban atas pertanyaan yang sering diajukan: alur izin, aturan pengisian, slip gaji, pinjam mobil, dan lainnya.
          </p>
        </div>
      </div>
      <FaqBrowser topics={topics} />
    </div>
  )
}
