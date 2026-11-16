import { LifeBuoy } from "lucide-react"

import { faqTopicsFor } from "@/lib/faq-content"
import { Breadcrumb } from "@/components/breadcrumb"
import { FaqBrowser } from "@/components/faq-browser"

export default function BantuanPegawaiPage() {
  // Admin yang membuka versi pegawai tetap hanya melihat topik pegawai di
  // sini — panduan admin ada di /admin/bantuan.
  const topics = faqTopicsFor("EMPLOYEE")

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
            Jawaban atas pertanyaan yang sering diajukan: alur izin, aturan pengisian, slip gaji, dan lainnya.
          </p>
        </div>
      </div>
      <FaqBrowser topics={topics} />
    </div>
  )
}
