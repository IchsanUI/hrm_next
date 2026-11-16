import { redirect } from "next/navigation"
import { LifeBuoy } from "lucide-react"

import { auth } from "@/auth"
import { faqTopicsFor } from "@/lib/faq-content"
import { Breadcrumb } from "@/components/breadcrumb"
import { FaqBrowser } from "@/components/faq-browser"

export default async function BantuanAdminPage() {
  const session = await auth()
  const role = session?.user.role
  if (role !== "SUPER_ADMIN" && role !== "HR_ADMIN") {
    redirect("/pegawai/bantuan")
  }

  return (
    <div>
      <Breadcrumb items={[{ label: "Dashboard", href: "/admin/dashboard" }, { label: "Pusat Bantuan" }]} />
      <div className="mb-6 flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <LifeBuoy className="size-5" />
        </span>
        <div>
          <h1 className="text-xl font-semibold sm:text-2xl">Pusat Bantuan</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {role === "SUPER_ADMIN"
              ? "Panduan pengaturan sistem (monitoring, backup, arsip, hak akses) beserta panduan untuk admin HR dan pegawai."
              : "Panduan untuk admin HR beserta jawaban pertanyaan yang sering diajukan pegawai."}
          </p>
        </div>
      </div>
      <FaqBrowser topics={faqTopicsFor(role)} />
    </div>
  )
}
