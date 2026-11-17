import Link from "next/link"
import { redirect } from "next/navigation"
import { Info } from "lucide-react"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { currentPlafonYear, getClaimEligibility, getHealthClaimSettings, getPlafonSummary } from "@/lib/health-claim"
import { Breadcrumb } from "@/components/breadcrumb"
import { HealthClaimForm, type PatientOption } from "@/components/health-claim-form"

export default async function AjukanKlaimKesehatanPage() {
  const session = await auth()
  const employeeId = session?.user.employeeId
  if (!employeeId) redirect("/login")

  const eligibility = await getClaimEligibility(employeeId)
  const breadcrumb = (
    <Breadcrumb
      items={[
        { label: "Dashboard", href: "/pegawai/dashboard" },
        { label: "Klaim Kesehatan", href: "/pegawai/klaim-kesehatan" },
        { label: "Ajukan Klaim" },
      ]}
    />
  )

  if (!eligibility.eligible) {
    return (
      <div>
        {breadcrumb}
        <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          <Info className="mt-0.5 size-4 shrink-0" />
          <span>
            {eligibility.reason}{" "}
            <Link href="/pegawai/klaim-kesehatan" className="font-medium underline">
              Kembali
            </Link>
          </span>
        </div>
      </div>
    )
  }

  const { plafonStartMonth } = await getHealthClaimSettings()
  const year = currentPlafonYear(plafonStartMonth)
  const [types, employee, settings, summary] = await Promise.all([
    prisma.healthClaimType.findMany({
      where: { isActive: true },
      select: { publicId: true, name: true, description: true, requiredDocumentLabel: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        fullName: true,
        spouse: { select: { fullName: true } },
        children: { select: { id: true, fullName: true }, orderBy: { birthDate: "asc" } },
      },
    }),
    getHealthClaimSettings(),
    getPlafonSummary(employeeId, year, eligibility.plafon),
  ])

  const patients: PatientOption[] = [
    { value: "SELF", label: employee?.fullName ?? "Diri sendiri", hint: "Diri sendiri" },
    ...(employee?.spouse ? [{ value: "SPOUSE", label: employee.spouse.fullName, hint: "Suami/Istri" }] : []),
    ...(employee?.children ?? []).map((c) => ({ value: `CHILD:${c.id}`, label: c.fullName, hint: "Anak" })),
  ]

  return (
    <div>
      {breadcrumb}
      <h1 className="text-xl font-semibold sm:text-2xl">Ajukan Klaim Kesehatan</h1>
      <p className="mt-0.5 mb-6 text-sm text-muted-foreground">
        Klaim akan diperiksa petugas, lalu diajukan ke Direktur bersama klaim pegawai lain dalam satu Nota Dinas.
      </p>
      {types.length === 0 ? (
        <p className="rounded-lg border px-4 py-6 text-center text-sm text-muted-foreground">
          Belum ada jenis klaim yang aktif. Hubungi HR.
        </p>
      ) : (
        <HealthClaimForm
          types={types}
          patients={patients}
          remainingPlafon={summary.remaining}
          deadlineDays={settings.submissionDeadlineDays}
        />
      )}
    </div>
  )
}
