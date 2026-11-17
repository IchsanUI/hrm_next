import { notFound, redirect } from "next/navigation"
import { RotateCcw } from "lucide-react"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { decryptField } from "@/lib/encryption"
import { getClaimEligibility, getPlafonSummary } from "@/lib/health-claim"
import { Breadcrumb } from "@/components/breadcrumb"
import { HealthClaimForm, type PatientOption } from "@/components/health-claim-form"

const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "")

export default async function PerbaikiKlaimPage({ params }: { params: Promise<{ publicId: string }> }) {
  const session = await auth()
  const employeeId = session?.user.employeeId
  if (!employeeId) redirect("/login")

  const { publicId } = await params
  const claim = await prisma.healthClaim.findUnique({
    where: { publicId },
    include: {
      claimType: { select: { publicId: true } },
      items: { orderBy: { order: "asc" } },
      documents: { orderBy: { createdAt: "asc" }, select: { id: true, publicId: true, originalName: true, storedFileName: true } },
      events: { where: { action: "REVISI" }, orderBy: { createdAt: "desc" }, take: 1 },
    },
  })
  if (!claim || claim.employeeId !== employeeId) notFound()
  if (claim.status !== "REVISI") redirect(`/pegawai/klaim-kesehatan/${publicId}`)

  const eligibility = await getClaimEligibility(employeeId)
  const [types, employee, summary] = await Promise.all([
    prisma.healthClaimType.findMany({
      // Jenis yang sudah dinonaktifkan tetap ditampilkan bila dipakai klaim ini.
      where: { OR: [{ isActive: true }, { id: claim.claimTypeId }] },
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
    // Sisa plafon tanpa klaim ini sendiri (nominalnya akan dihitung ulang).
    getPlafonSummary(employeeId, claim.plafonYear, eligibility.plafon ?? 0, { excludeClaimId: claim.id }),
  ])

  const patients: PatientOption[] = [
    { value: "SELF", label: employee?.fullName ?? "Diri sendiri", hint: "Diri sendiri" },
    ...(employee?.spouse ? [{ value: "SPOUSE", label: employee.spouse.fullName, hint: "Suami/Istri" }] : []),
    ...(employee?.children ?? []).map((c) => ({ value: `CHILD:${c.id}`, label: c.fullName, hint: "Anak" })),
  ]

  let diagnosis = ""
  if (claim.diagnosis) {
    try {
      diagnosis = decryptField(claim.diagnosis)
    } catch {
      diagnosis = ""
    }
  }
  const revisionNote = claim.events[0]

  return (
    <div>
      <Breadcrumb
        items={[
          { label: "Dashboard", href: "/pegawai/dashboard" },
          { label: "Klaim Kesehatan", href: "/pegawai/klaim-kesehatan" },
          { label: claim.claimNumber, href: `/pegawai/klaim-kesehatan/${publicId}` },
          { label: "Perbaiki" },
        ]}
      />
      <h1 className="text-xl font-semibold sm:text-2xl">Perbaiki Klaim {claim.claimNumber}</h1>
      {revisionNote ? (
        <div className="mt-3 mb-6 flex items-start gap-2 rounded-lg border border-orange-300 bg-orange-50 px-4 py-3 text-sm text-orange-900 dark:border-orange-800 dark:bg-orange-950/40 dark:text-orange-200">
          <RotateCcw className="mt-0.5 size-4 shrink-0" />
          <span>
            <span className="font-medium">Catatan dari {revisionNote.actorName}:</span> {revisionNote.note}
          </span>
        </div>
      ) : (
        <div className="mb-6" />
      )}
      <HealthClaimForm
        types={types}
        patients={patients}
        remainingPlafon={summary.remaining}
        deadlineDays={null}
        initial={{
          claimPublicId: claim.publicId,
          patient: claim.patientType === "CHILD" ? `CHILD:${claim.childId}` : claim.patientType,
          typeId: claim.claimType.publicId,
          treatmentDate: iso(claim.treatmentDate),
          dischargeDate: iso(claim.dischargeDate),
          facility: claim.facility,
          diagnosis,
          amount: claim.requestedAmount,
          documents: claim.documents.map((d) => ({
            id: d.id,
            publicId: d.publicId,
            originalName: d.originalName,
            isPdf: d.storedFileName.endsWith(".pdf"),
          })),
        }}
      />
    </div>
  )
}
