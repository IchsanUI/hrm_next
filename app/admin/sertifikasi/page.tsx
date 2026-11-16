import { redirect } from "next/navigation"
import { Award } from "lucide-react"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { getComplianceOverview } from "@/lib/certification-compliance"
import { certificateStatus, startOfTodayUtc } from "@/lib/certification-status"
import { Breadcrumb } from "@/components/breadcrumb"
import { Card, CardContent } from "@/components/ui/card"
import { CertificationManager, type CertRow, type CertTypeRow } from "@/components/certification-manager"

const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null)

export default async function SertifikasiPage({
  searchParams,
}: {
  searchParams: Promise<{ pegawai?: string }>
}) {
  const session = await auth()
  const user = session?.user
  const allowed =
    user?.role === "SUPER_ADMIN" ||
    (user?.role === "HR_ADMIN" && user.menuAccess.includes("kepegawaian.sertifikasi"))
  if (!allowed) redirect("/admin/dashboard")

  const { pegawai } = await searchParams
  const today = startOfTodayUtc()
  const [types, certs, employees, positions, overview] = await Promise.all([
    prisma.certificationType.findMany({
      include: {
        requiredPositions: { include: { position: { select: { id: true, name: true } } } },
        _count: { select: { certifications: true } },
      },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
    }),
    prisma.employeeCertification.findMany({
      where: { employee: { isDeleted: false } },
      include: {
        employee: { select: { publicId: true, fullName: true, employeeNumber: true, position: { select: { name: true } } } },
        certificationType: { select: { publicId: true, name: true, kind: true, reminderDays: true } },
      },
      orderBy: [{ expiryDate: "asc" }],
    }),
    prisma.employee.findMany({
      where: { isActive: true, isDeleted: false },
      select: { publicId: true, fullName: true, employeeNumber: true, position: { select: { name: true } } },
      orderBy: { fullName: "asc" },
    }),
    prisma.position.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    getComplianceOverview(),
  ])

  const typeRows: CertTypeRow[] = types.map((t) => ({
    publicId: t.publicId,
    name: t.name,
    kind: t.kind,
    issuer: t.issuer,
    validityMonths: t.validityMonths,
    reminderDays: t.reminderDays,
    description: t.description,
    requiredForAll: t.requiredForAll,
    isActive: t.isActive,
    positionIds: t.requiredPositions.map((p) => p.position.id),
    positionNames: t.requiredPositions.map((p) => p.position.name),
    certCount: t._count.certifications,
  }))

  const certRows: CertRow[] = certs.map((c) => ({
    publicId: c.publicId,
    employeePublicId: c.employee.publicId,
    employeeName: c.employee.fullName,
    employeeNumber: c.employee.employeeNumber,
    position: c.employee.position.name,
    typePublicId: c.certificationType.publicId,
    typeName: c.certificationType.name,
    kind: c.certificationType.kind,
    certificateNumber: c.certificateNumber,
    issuer: c.issuer,
    issuedDate: iso(c.issuedDate)!,
    expiryDate: iso(c.expiryDate),
    notes: c.notes,
    originalFileName: c.storedFileName ? c.originalFileName ?? "sertifikat" : null,
    status: certificateStatus(c.expiryDate, c.certificationType.reminderDays, today),
  }))

  const { totals, required } = overview
  const compliant = totals.TERPENUHI + totals.SEGERA
  const stats = [
    {
      label: "Tingkat Kepatuhan",
      value: required ? `${Math.round((compliant / required) * 100)}%` : "—",
      hint: required ? `${compliant} dari ${required} kewajiban` : "Belum ada kewajiban",
    },
    { label: "Belum Ada", value: totals.BELUM_ADA, hint: "Wajib tapi belum tercatat" },
    { label: "Kedaluwarsa", value: totals.KEDALUWARSA, hint: "Perlu diperpanjang" },
    { label: "Segera Kedaluwarsa", value: totals.SEGERA, hint: "Masuk masa pengingat" },
  ]

  return (
    <div>
      <Breadcrumb
        items={[
          { label: "Dashboard", href: "/admin/dashboard" },
          { label: "Kepegawaian" },
          { label: "Sertifikasi & Pelatihan" },
        ]}
      />
      <div className="mb-6 flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Award className="size-5" />
        </span>
        <div>
          <h1 className="text-xl font-semibold sm:text-2xl">Sertifikasi & Pelatihan Wajib</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Pantau sertifikasi dan pelatihan yang wajib dimiliki pegawai, masa berlakunya, serta siapa yang belum memenuhi.
          </p>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="py-0">
            <CardContent className="px-4 py-3.5">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <CertificationManager
        types={typeRows}
        certificates={certRows}
        employees={employees.map((e) => ({
          publicId: e.publicId,
          name: e.fullName,
          number: e.employeeNumber,
          position: e.position.name,
        }))}
        positions={positions}
        summaries={overview.summaries}
        requirements={overview.rows}
        initialEmployee={pegawai}
      />
    </div>
  )
}
