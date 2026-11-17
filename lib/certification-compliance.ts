import type { CertificationKind } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import {
  certificateStatus,
  pickLatest,
  startOfTodayUtc,
  type CertificateStatus,
  type ComplianceStatus,
} from "@/lib/certification-status"

// Satu baris kewajiban: pegawai X wajib punya sertifikasi Y.
export type RequirementRow = {
  employeePublicId: string
  employeeName: string
  employeeNumber: string
  position: string
  department: string
  typePublicId: string
  typeName: string
  kind: CertificationKind
  status: ComplianceStatus
  expiryDate: string | null // yyyy-mm-dd dari sertifikat yang menentukan
}

export type TypeSummary = {
  typePublicId: string
  name: string
  kind: CertificationKind
  required: number
  TERPENUHI: number
  SEGERA: number
  KEDALUWARSA: number
  BELUM_ADA: number
}

type TypeWithRequirement = {
  id: number
  requiredForAll: boolean
  reminderDays: number
  requiredPositions: { positionId: number }[]
}

export function isRequiredFor(type: TypeWithRequirement, positionId: number) {
  return type.requiredForAll || type.requiredPositions.some((p) => p.positionId === positionId)
}

function toComplianceStatus(cert: { expiryDate: Date | null } | undefined, reminderDays: number, today: Date): ComplianceStatus {
  if (!cert) return "BELUM_ADA"
  const s: CertificateStatus = certificateStatus(cert.expiryDate, reminderDays, today)
  return s === "AKTIF" ? "TERPENUHI" : s
}

const isoDate = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null)

export async function getComplianceOverview() {
  const today = startOfTodayUtc()
  const [types, employees] = await Promise.all([
    prisma.certificationType.findMany({
      where: { isActive: true },
      include: { requiredPositions: { select: { positionId: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.employee.findMany({
      where: { isActive: true, isDeleted: false },
      select: {
        id: true,
        publicId: true,
        fullName: true,
        employeeNumber: true,
        positionId: true,
        position: { select: { name: true } },
        department: { select: { name: true } },
        certifications: { select: { certificationTypeId: true, expiryDate: true } },
      },
      orderBy: { fullName: "asc" },
    }),
  ])

  const mandatoryTypes = types.filter((t) => t.requiredForAll || t.requiredPositions.length > 0)
  const rows: RequirementRow[] = []
  const summaries = new Map<number, TypeSummary>(
    mandatoryTypes.map((t) => [
      t.id,
      { typePublicId: t.publicId, name: t.name, kind: t.kind, required: 0, TERPENUHI: 0, SEGERA: 0, KEDALUWARSA: 0, BELUM_ADA: 0 },
    ])
  )

  for (const emp of employees) {
    for (const type of mandatoryTypes) {
      if (!isRequiredFor(type, emp.positionId)) continue
      const best = pickLatest(emp.certifications.filter((c) => c.certificationTypeId === type.id))
      const status = toComplianceStatus(best, type.reminderDays, today)
      const summary = summaries.get(type.id)!
      summary.required += 1
      summary[status] += 1
      rows.push({
        employeePublicId: emp.publicId,
        employeeName: emp.fullName,
        employeeNumber: emp.employeeNumber,
        position: emp.position.name,
        department: emp.department.name,
        typePublicId: type.publicId,
        typeName: type.name,
        kind: type.kind,
        status,
        expiryDate: isoDate(best?.expiryDate ?? null),
      })
    }
  }

  const totals = rows.reduce(
    (acc, r) => {
      acc[r.status] += 1
      return acc
    },
    { TERPENUHI: 0, SEGERA: 0, KEDALUWARSA: 0, BELUM_ADA: 0 } as Record<ComplianceStatus, number>
  )

  return { rows, summaries: [...summaries.values()], totals, required: rows.length }
}

// Ringkasan per pegawai — untuk detail pegawai (admin) & Profil Saya.
export async function getEmployeeCertificationSummary(employeeId: number) {
  const today = startOfTodayUtc()
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: {
      positionId: true,
      certifications: {
        include: { certificationType: { select: { name: true, kind: true, reminderDays: true } } },
        orderBy: { issuedDate: "desc" },
      },
    },
  })
  if (!employee) return null

  const types = await prisma.certificationType.findMany({
    where: { isActive: true },
    include: { requiredPositions: { select: { positionId: true } } },
    orderBy: { name: "asc" },
  })

  const certificates = employee.certifications.map((c) => ({
    publicId: c.publicId,
    typeName: c.certificationType.name,
    kind: c.certificationType.kind,
    certificateNumber: c.certificateNumber,
    issuer: c.issuer,
    issuedDate: isoDate(c.issuedDate)!,
    expiryDate: isoDate(c.expiryDate),
    hasFile: Boolean(c.storedFileName),
    status: certificateStatus(c.expiryDate, c.certificationType.reminderDays, today),
  }))

  const requirements = types
    .filter((t) => isRequiredFor(t, employee.positionId))
    .map((t) => {
      const best = pickLatest(employee.certifications.filter((c) => c.certificationTypeId === t.id))
      return {
        typeName: t.name,
        kind: t.kind,
        status: toComplianceStatus(best, t.reminderDays, today),
        expiryDate: isoDate(best?.expiryDate ?? null),
      }
    })

  return { certificates, requirements }
}

export type EmployeeCertificationSummary = NonNullable<Awaited<ReturnType<typeof getEmployeeCertificationSummary>>>
