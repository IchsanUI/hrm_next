import { HeartPulse } from "lucide-react"

import { Breadcrumb } from "@/components/breadcrumb"
import { Card, CardContent } from "@/components/ui/card"

export default function PegawaiKlaimKesehatanPage() {
  return (
    <div>
      <Breadcrumb
        items={[
          { label: "Dashboard", href: "/pegawai/dashboard" },
          { label: "Klaim Kesehatan" },
        ]}
      />
      <div className="mb-6 flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <HeartPulse className="size-5" />
        </span>
        <div>
          <h1 className="text-xl font-semibold sm:text-2xl">Klaim Kesehatan</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Ajukan klaim/reimbursement biaya kesehatan Anda di sini.
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="py-10 text-center">
          <p className="font-medium">Modul ini belum dikembangkan</p>
        </CardContent>
      </Card>
    </div>
  )
}
