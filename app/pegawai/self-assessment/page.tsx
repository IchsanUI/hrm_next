import { Breadcrumb } from "@/components/breadcrumb"

export default function SelfAssessmentPage() {
  return (
    <div>
      <Breadcrumb
        items={[
          { label: "Dashboard", href: "/pegawai/dashboard" },
          { label: "Self Assessment" },
        ]}
      />
      <h1 className="mb-1 text-2xl font-semibold">Self Assessment</h1>
      <p className="text-sm text-muted-foreground">
        Modul ini sedang disiapkan. Fitur penilaian diri akan tersedia di sini.
      </p>
    </div>
  )
}
