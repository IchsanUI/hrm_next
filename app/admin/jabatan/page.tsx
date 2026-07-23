import { prisma } from "@/lib/prisma"
import { Breadcrumb } from "@/components/breadcrumb"
import { PositionTable } from "@/components/position-table"

export default async function JabatanPage() {
  const positions = await prisma.position.findMany({
    orderBy: { name: "asc" },
  })

  return (
    <div>
      <Breadcrumb
        items={[
          { label: "Dashboard", href: "/admin/dashboard" },
          { label: "Data Jabatan" },
        ]}
      />
      <h1 className="mb-1 text-2xl font-semibold">Data Jabatan</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Rate Tunjangan Kehadiran per hari dipakai otomatis saat Proses
        Payroll (rate × jumlah hari hadir pegawai di jabatan itu selama
        periode berjalan).
      </p>
      <PositionTable positions={positions} />
    </div>
  )
}
