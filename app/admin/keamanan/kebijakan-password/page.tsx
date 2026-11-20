import { redirect } from "next/navigation"
import { KeyRound } from "lucide-react"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { computePasswordStatus, getPasswordPolicy, type PasswordState } from "@/lib/password-policy"
import { Breadcrumb } from "@/components/breadcrumb"
import { PasswordPolicyForm } from "@/components/password-policy-form"
import { PasswordStatusBadge } from "@/components/password-status-badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

function toDateInput(date: Date) {
  // yyyy-MM-dd menurut WIB (server TZ Asia/Jakarta).
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

function formatDate(date: Date | null) {
  return date ? date.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "-"
}

const SUMMARY: { state: PasswordState; label: string }[] = [
  { state: "MUST_CHANGE", label: "Wajib ganti (awal/reset)" },
  { state: "EXPIRED", label: "Kedaluwarsa" },
  { state: "WARNING", label: "Mendekati tenggat" },
  { state: "ACTIVE", label: "Aktif" },
  { state: "NOT_ENFORCED", label: "Belum diberlakukan" },
]

// Keamanan → Kebijakan Password (PRD docs/prd-masa-berlaku-password.md).
export default async function KebijakanPasswordPage() {
  const session = await auth()
  if (session?.user.role !== "SUPER_ADMIN") redirect("/admin/dashboard")

  const [policy, users] = await Promise.all([
    getPasswordPolicy(),
    prisma.user.findMany({
      where: { isActive: true },
      select: {
        id: true,
        username: true,
        passwordChangedAt: true,
        mustChangePassword: true,
        role: { select: { name: true } },
        employee: { select: { fullName: true } },
      },
      orderBy: { username: "asc" },
    }),
  ])

  const rows = users.map((u) => ({ ...u, status: computePasswordStatus(u, policy) }))
  const counts = new Map<PasswordState, number>()
  for (const r of rows) counts.set(r.status.state, (counts.get(r.status.state) ?? 0) + 1)
  // Yang perlu perhatian dulu: wajib ganti, kedaluwarsa, lalu yang paling dekat tenggat.
  const attention = rows
    .filter((r) => r.status.state === "MUST_CHANGE" || r.status.state === "EXPIRED" || r.status.state === "WARNING")
    .sort((a, b) => (a.status.daysLeft ?? -1) - (b.status.daysLeft ?? -1))

  return (
    <div>
      <Breadcrumb items={[{ label: "Dashboard", href: "/admin/dashboard" }, { label: "Kebijakan Password" }]} />
      <div className="mb-6 flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <KeyRound className="size-5" />
        </span>
        <div>
          <h1 className="text-xl font-semibold sm:text-2xl">Kebijakan Password</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Masa berlaku & riwayat password akun HRIS — PADK OJK 43/PADK.03/2025, Pengamanan Logic.
          </p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] xl:items-start">
        <PasswordPolicyForm
          defaults={{
            enabled: !!policy.intervalDays,
            intervalDays: policy.intervalDays ?? 90,
            warningDays: policy.warningDays,
            historyCount: policy.historyCount,
            effectiveDate: toDateInput(policy.effectiveAt ?? new Date()),
          }}
        />

        <Card className="gap-0 pb-0">
          <CardHeader className="pb-4">
            <CardTitle>Status Password Akun Aktif</CardTitle>
            <CardDescription>{users.length} akun aktif, dihitung dengan kebijakan yang sedang berlaku.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 p-0">
            <div className="grid grid-cols-2 gap-3 px-6 sm:grid-cols-5">
              {SUMMARY.map((s) => (
                <div key={s.state} className="rounded-lg border p-3">
                  <p className="text-xl font-semibold tabular-nums">{counts.get(s.state) ?? 0}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              ))}
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Akun</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="pr-6">Tenggat</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attention.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                      Tidak ada akun yang perlu ganti password saat ini.
                    </TableCell>
                  </TableRow>
                ) : (
                  attention.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="pl-6">
                        <p className="font-medium">{r.employee?.fullName ?? r.username}</p>
                        <p className="text-xs text-muted-foreground">{r.username}</p>
                      </TableCell>
                      <TableCell>{r.role.name.replace("_", " ")}</TableCell>
                      <TableCell>
                        <PasswordStatusBadge status={r.status} />
                      </TableCell>
                      <TableCell className="pr-6 whitespace-nowrap">{formatDate(r.status.dueAt)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
