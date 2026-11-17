import Link from "next/link"
import { notFound, redirect } from "next/navigation"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { isHealthClaimStaff } from "@/lib/health-claim"
import { buildMemoDraftRows, getMemoSettings } from "@/lib/health-claim-memo"
import { formatClaimDate } from "@/lib/health-claim-labels"
import { Breadcrumb } from "@/components/breadcrumb"
import { HealthClaimMemoBuilder } from "@/components/health-claim-memo-builder"

export default async function BuatNotaDinasPage() {
  const session = await auth()
  const user = session?.user
  if (!user?.employeeId) redirect("/login")
  if (!(await isHealthClaimStaff(user.employeeId, "PETUGAS"))) notFound()

  const queued = await prisma.healthClaim.findMany({ where: { status: "TERKONFIRMASI" }, select: { id: true } })
  const [rows, settings, flowCount] = await Promise.all([
    buildMemoDraftRows(queued.map((c) => c.id)),
    getMemoSettings(),
    prisma.healthClaimMemoFlowStep.count(),
  ])
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" })

  return (
    <div>
      <Breadcrumb
        items={[
          { label: "Dashboard", href: "/pegawai/dashboard" },
          { label: "Pemeriksaan Klaim", href: "/pegawai/pemeriksaan-klaim" },
          { label: "Nota Dinas", href: "/pegawai/pemeriksaan-klaim/nota-dinas" },
          { label: "Buat" },
        ]}
      />
      <h1 className="text-xl font-semibold sm:text-2xl">Buat Nota Dinas</h1>
      <p className="mt-0.5 mb-6 text-sm text-muted-foreground">
        Satukan klaim terkonfirmasi menjadi satu surat pengajuan dana ke Direksi.
      </p>
      {flowCount === 0 ? (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          Alur persetujuan Nota Dinas belum diatur. Minta admin mengisinya di Pengaturan Klaim Kesehatan → Nota Dinas.
        </p>
      ) : rows.length === 0 ? (
        <p className="rounded-lg border px-4 py-10 text-center text-sm text-muted-foreground">
          Belum ada klaim terkonfirmasi.{" "}
          <Link href="/pegawai/pemeriksaan-klaim" className="text-primary hover:underline">
            Periksa klaim yang menunggu konfirmasi
          </Link>
          .
        </p>
      ) : (
        <HealthClaimMemoBuilder
          rows={rows.map((r) => ({
            claimPublicId: r.claimPublicId,
            claimNumber: r.claimNumber,
            employeeId: r.employeeId,
            employeeName: r.employeeName,
            patientLabel: r.patientLabel,
            claimTypeName: r.claimTypeName,
            treatmentDate: formatClaimDate(r.treatmentDate.toISOString()),
            amount: r.amount,
            balanceBefore: r.balanceBefore,
            defaultNote: r.defaultNote,
          }))}
          minEmployees={settings.minEmployeesPerMemo}
          canForce={user.role === "SUPER_ADMIN"}
          defaults={{
            toText: settings.memoTo,
            fromText: settings.memoFrom,
            subject: settings.memoSubject,
            opening: settings.memoOpening,
            closing: settings.memoClosing,
          }}
          today={today}
          doneBasePath="/pegawai/pemeriksaan-klaim/nota-dinas"
        />
      )}
    </div>
  )
}
