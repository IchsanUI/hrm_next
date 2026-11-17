"use client"

import { useMemo, useState, useTransition } from "react"
import type { CertificationKind } from "@prisma/client"
import {
  AlertTriangle,
  Download,
  FileText,
  Loader2,
  Paperclip,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
} from "lucide-react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import {
  COMPLIANCE_STATUS_LABEL,
  KIND_LABEL,
  daysUntil,
  defaultExpiryDate,
  formatValidity,
  type CertificateStatus,
  type ComplianceStatus,
} from "@/lib/certification-status"
import type { RequirementRow, TypeSummary } from "@/lib/certification-compliance"
import {
  deleteCertificationTypeAction,
  deleteEmployeeCertificationAction,
  saveCertificationTypeAction,
  saveEmployeeCertificationAction,
} from "@/server/actions/certifications"
import { CertificateBadge, COMPLIANCE_BAR_CLASS, ComplianceBadge } from "@/components/certification-status-badge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsList, TabsPanel, TabsTrigger } from "@/components/ui/tabs"

export type CertTypeRow = {
  publicId: string
  name: string
  kind: CertificationKind
  issuer: string | null
  validityMonths: number | null
  reminderDays: number
  description: string | null
  requiredForAll: boolean
  isActive: boolean
  positionIds: number[]
  positionNames: string[]
  certCount: number
}

export type CertRow = {
  publicId: string
  employeePublicId: string
  employeeName: string
  employeeNumber: string
  position: string
  typePublicId: string
  typeName: string
  kind: CertificationKind
  certificateNumber: string | null
  issuer: string | null
  issuedDate: string
  expiryDate: string | null
  notes: string | null
  originalFileName: string | null
  status: CertificateStatus
}

type Option = { value: string; label: string }

function formatDate(iso: string | null) {
  if (!iso) return "Selamanya"
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" })
}

function expiryHint(iso: string | null) {
  const left = daysUntil(iso)
  if (left === null) return null
  if (left < 0) return `lewat ${-left} hari`
  if (left === 0) return "berakhir hari ini"
  return `${left} hari lagi`
}

function Pills<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string; count?: number }[]
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const active = value === o.value
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              active ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"
            )}
          >
            {o.label}
            {o.count !== undefined ? (
              <span className={cn("tabular-nums", active ? "opacity-80" : "text-muted-foreground")}>{o.count}</span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}

function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative sm:w-72">
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="pl-8" />
    </div>
  )
}

function EmptyState({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5 px-4 py-14 text-center">
      <p className="text-sm font-medium">{title}</p>
      <p className="max-w-md text-xs text-muted-foreground">{hint}</p>
    </div>
  )
}

export function CertificationManager({
  types,
  certificates,
  employees,
  positions,
  summaries,
  requirements,
  initialEmployee,
}: {
  types: CertTypeRow[]
  certificates: CertRow[]
  employees: { publicId: string; name: string; number: string; position: string }[]
  positions: { id: number; name: string }[]
  summaries: TypeSummary[]
  requirements: RequirementRow[]
  initialEmployee?: string
}) {
  const [tab, setTab] = useState<string>(initialEmployee ? "sertifikat" : "kepatuhan")
  const [certTarget, setCertTarget] = useState<CertRow | "new" | null>(null)
  const [certPrefill, setCertPrefill] = useState<{ employee?: string; type?: string }>({})
  const [typeTarget, setTypeTarget] = useState<CertTypeRow | "new" | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<
    { kind: "cert"; row: CertRow } | { kind: "type"; row: CertTypeRow } | null
  >(null)

  const employeeOptions: Option[] = employees.map((e) => ({ value: e.publicId, label: `${e.name} (${e.number})` }))
  const activeTypes = types.filter((t) => t.isActive)

  function addCertificate(prefill: { employee?: string; type?: string } = {}) {
    setCertPrefill(prefill)
    setCertTarget("new")
  }

  return (
    <>
      <Tabs value={tab} onValueChange={(v) => setTab(String(v))}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <TabsList>
            <TabsTrigger value="kepatuhan">Kepatuhan</TabsTrigger>
            <TabsTrigger value="sertifikat">Sertifikat Pegawai ({certificates.length})</TabsTrigger>
            <TabsTrigger value="jenis">Jenis Sertifikasi ({types.length})</TabsTrigger>
          </TabsList>
          <div className="flex gap-2">
            <Button
              variant="outline"
              nativeButton={false}
              render={<a href="/api/sertifikasi/rekap" />}
            >
              <Download className="size-4" />
              Unduh Rekap
            </Button>
            {tab === "jenis" ? (
              <Button onClick={() => setTypeTarget("new")}>
                <Plus className="size-4" />
                Tambah Jenis
              </Button>
            ) : (
              <Button onClick={() => addCertificate()} disabled={activeTypes.length === 0}>
                <Plus className="size-4" />
                Tambah Sertifikat
              </Button>
            )}
          </div>
        </div>

        <TabsPanel value="kepatuhan" className="mt-4">
          <ComplianceTab
            summaries={summaries}
            requirements={requirements}
            hasTypes={types.length > 0}
            onGoToTypes={() => setTab("jenis")}
            onAdd={(employee, type) => addCertificate({ employee, type })}
          />
        </TabsPanel>
        <TabsPanel value="sertifikat" className="mt-4">
          <CertificatesTab
            rows={certificates}
            initialQuery={employees.find((e) => e.publicId === initialEmployee)?.name ?? ""}
            onEdit={(row) => setCertTarget(row)}
            onDelete={(row) => setConfirmDelete({ kind: "cert", row })}
          />
        </TabsPanel>
        <TabsPanel value="jenis" className="mt-4">
          <TypesTab
            rows={types}
            onEdit={(row) => setTypeTarget(row)}
            onDelete={(row) => setConfirmDelete({ kind: "type", row })}
          />
        </TabsPanel>
      </Tabs>

      {certTarget ? (
        <CertificateDialog
          key={certTarget === "new" ? `new-${certPrefill.employee ?? ""}-${certPrefill.type ?? ""}` : certTarget.publicId}
          target={certTarget}
          prefill={certPrefill}
          employeeOptions={employeeOptions}
          types={certTarget === "new" ? activeTypes : types}
          onClose={() => setCertTarget(null)}
        />
      ) : null}
      {typeTarget ? (
        <TypeDialog
          key={typeTarget === "new" ? "new" : typeTarget.publicId}
          target={typeTarget}
          positions={positions}
          onClose={() => setTypeTarget(null)}
        />
      ) : null}
      {confirmDelete ? <DeleteDialog target={confirmDelete} onClose={() => setConfirmDelete(null)} /> : null}
    </>
  )
}

// ─────────────────────────────── Kepatuhan ───────────────────────────────

const STATUS_ORDER: ComplianceStatus[] = ["BELUM_ADA", "KEDALUWARSA", "SEGERA", "TERPENUHI"]

function ComplianceTab({
  summaries,
  requirements,
  hasTypes,
  onGoToTypes,
  onAdd,
}: {
  summaries: TypeSummary[]
  requirements: RequirementRow[]
  hasTypes: boolean
  onGoToTypes: () => void
  onAdd: (employeePublicId: string, typePublicId: string) => void
}) {
  const [status, setStatus] = useState<ComplianceStatus | "PERLU_TINDAKAN" | "ALL">("PERLU_TINDAKAN")
  const [typeFilter, setTypeFilter] = useState<string>("ALL")
  const [query, setQuery] = useState("")

  if (summaries.length === 0) {
    return (
      <Card className="py-0">
        <EmptyState
          title="Belum ada sertifikasi/pelatihan yang diwajibkan"
          hint={
            hasTypes
              ? "Tandai jenis sertifikasi sebagai wajib untuk semua pegawai atau jabatan tertentu agar kepatuhannya terpantau di sini."
              : "Mulai dengan menambahkan jenis sertifikasi, misalnya Sertifikasi Manajemen Risiko atau Pelatihan APU-PPT, lalu tentukan jabatan yang wajib memilikinya."
          }
        />
        <div className="flex justify-center pb-10">
          <Button variant="outline" onClick={onGoToTypes}>
            Buka Jenis Sertifikasi
          </Button>
        </div>
      </Card>
    )
  }

  const q = query.trim().toLowerCase()
  const visible = requirements
    .filter((r) => typeFilter === "ALL" || r.typePublicId === typeFilter)
    .filter((r) =>
      status === "ALL" ? true : status === "PERLU_TINDAKAN" ? r.status !== "TERPENUHI" : r.status === status
    )
    .filter((r) => !q || r.employeeName.toLowerCase().includes(q) || r.department.toLowerCase().includes(q))
    .sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) || a.employeeName.localeCompare(b.employeeName))

  const scoped = requirements.filter((r) => typeFilter === "ALL" || r.typePublicId === typeFilter)
  const count = (s: ComplianceStatus) => scoped.filter((r) => r.status === s).length

  return (
    <div className="grid gap-5">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {summaries.map((s) => {
          const ok = s.TERPENUHI + s.SEGERA
          const percent = s.required ? Math.round((ok / s.required) * 100) : 100
          const active = typeFilter === s.typePublicId
          return (
            <button
              key={s.typePublicId}
              type="button"
              onClick={() => setTypeFilter(active ? "ALL" : s.typePublicId)}
              className={cn(
                "grid gap-3 rounded-xl border bg-card p-4 text-left transition-colors hover:border-primary/50",
                active && "border-primary ring-1 ring-primary"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">{KIND_LABEL[s.kind]}</p>
                  <p className="line-clamp-2 text-sm font-semibold">{s.name}</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-semibold tabular-nums">{percent}%</p>
                  <p className="text-[11px] text-muted-foreground">
                    {ok}/{s.required} patuh
                  </p>
                </div>
              </div>
              {/* Bar bertumpuk: urutan & warna status tetap; celah 2px antarsegmen */}
              <div className="flex h-2 gap-0.5 overflow-hidden rounded-full">
                {(["TERPENUHI", "SEGERA", "KEDALUWARSA", "BELUM_ADA"] as ComplianceStatus[]).map((st) =>
                  s[st] > 0 ? (
                    <span
                      key={st}
                      className={cn("h-full first:rounded-l-full last:rounded-r-full", COMPLIANCE_BAR_CLASS[st])}
                      style={{ width: `${(s[st] / s.required) * 100}%` }}
                      title={`${COMPLIANCE_STATUS_LABEL[st]}: ${s[st]}`}
                    />
                  ) : null
                )}
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                {(["TERPENUHI", "SEGERA", "KEDALUWARSA", "BELUM_ADA"] as ComplianceStatus[]).map((st) => (
                  <span key={st} className="inline-flex items-center gap-1">
                    <span className={cn("size-2 rounded-full", COMPLIANCE_BAR_CLASS[st])} />
                    {COMPLIANCE_STATUS_LABEL[st]} <span className="font-medium text-foreground tabular-nums">{s[st]}</span>
                  </span>
                ))}
              </div>
            </button>
          )
        })}
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Pills
          value={status}
          onChange={setStatus}
          options={[
            { value: "PERLU_TINDAKAN", label: "Perlu Tindakan", count: scoped.length - count("TERPENUHI") },
            { value: "BELUM_ADA", label: "Belum Ada", count: count("BELUM_ADA") },
            { value: "KEDALUWARSA", label: "Kedaluwarsa", count: count("KEDALUWARSA") },
            { value: "SEGERA", label: "Segera Kedaluwarsa", count: count("SEGERA") },
            { value: "TERPENUHI", label: "Terpenuhi", count: count("TERPENUHI") },
            { value: "ALL", label: "Semua", count: scoped.length },
          ]}
        />
        <SearchBox value={query} onChange={setQuery} placeholder="Cari nama atau bagian" />
      </div>

      <Card className="gap-0 overflow-hidden py-0">
        {visible.length === 0 ? (
          <EmptyState
            title={status === "PERLU_TINDAKAN" ? "Semua kewajiban terpenuhi" : "Tidak ada data"}
            hint={status === "PERLU_TINDAKAN" ? "Tidak ada pegawai yang perlu ditindaklanjuti untuk filter ini." : "Ubah filter atau kata kunci."}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Pegawai</th>
                  <th className="px-4 py-2.5 font-medium">Sertifikasi/Pelatihan</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium">Berlaku s.d.</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {visible.map((r) => (
                  <tr key={`${r.employeePublicId}-${r.typePublicId}`} className="hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <p className="font-medium">{r.employeeName}</p>
                      <p className="text-xs text-muted-foreground">
                        {r.position} · {r.department}
                      </p>
                    </td>
                    <td className="px-4 py-3">{r.typeName}</td>
                    <td className="px-4 py-3">
                      <ComplianceBadge status={r.status} />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {r.status === "BELUM_ADA" ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <>
                          {formatDate(r.expiryDate)}
                          {expiryHint(r.expiryDate) ? (
                            <span className="block text-xs text-muted-foreground">{expiryHint(r.expiryDate)}</span>
                          ) : null}
                        </>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {r.status !== "TERPENUHI" ? (
                        <Button size="sm" variant="outline" onClick={() => onAdd(r.employeePublicId, r.typePublicId)}>
                          <Plus className="size-4" />
                          {r.status === "BELUM_ADA" ? "Input" : "Perbarui"}
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}

// ──────────────────────────── Sertifikat pegawai ────────────────────────────

function CertificatesTab({
  rows,
  initialQuery,
  onEdit,
  onDelete,
}: {
  rows: CertRow[]
  initialQuery: string
  onEdit: (row: CertRow) => void
  onDelete: (row: CertRow) => void
}) {
  const [query, setQuery] = useState(initialQuery)
  const [status, setStatus] = useState<CertificateStatus | "ALL">("ALL")

  const q = query.trim().toLowerCase()
  const visible = useMemo(
    () =>
      rows.filter(
        (r) =>
          (status === "ALL" || r.status === status) &&
          (!q ||
            r.employeeName.toLowerCase().includes(q) ||
            r.typeName.toLowerCase().includes(q) ||
            (r.certificateNumber ?? "").toLowerCase().includes(q))
      ),
    [rows, status, q]
  )
  const count = (s: CertificateStatus) => rows.filter((r) => r.status === s).length

  return (
    <div className="grid gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Pills
          value={status}
          onChange={setStatus}
          options={[
            { value: "ALL", label: "Semua", count: rows.length },
            { value: "AKTIF", label: "Berlaku", count: count("AKTIF") },
            { value: "SEGERA", label: "Segera Kedaluwarsa", count: count("SEGERA") },
            { value: "KEDALUWARSA", label: "Kedaluwarsa", count: count("KEDALUWARSA") },
          ]}
        />
        <SearchBox value={query} onChange={setQuery} placeholder="Cari pegawai, sertifikasi, atau nomor" />
      </div>
      <Card className="gap-0 overflow-hidden py-0">
        {visible.length === 0 ? (
          <EmptyState
            title={rows.length === 0 ? "Belum ada sertifikat tercatat" : "Tidak ada sertifikat yang cocok"}
            hint={rows.length === 0 ? "Klik Tambah Sertifikat untuk mencatat sertifikat pegawai." : "Ubah filter atau kata kunci."}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Pegawai</th>
                  <th className="px-4 py-2.5 font-medium">Sertifikasi/Pelatihan</th>
                  <th className="px-4 py-2.5 font-medium">Terbit</th>
                  <th className="px-4 py-2.5 font-medium">Berlaku s.d.</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {visible.map((r) => (
                  <tr key={r.publicId} className="hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <p className="font-medium">{r.employeeName}</p>
                      <p className="text-xs text-muted-foreground">
                        {r.employeeNumber} · {r.position}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <p>{r.typeName}</p>
                      <p className="text-xs text-muted-foreground">
                        {[r.certificateNumber, r.issuer].filter(Boolean).join(" · ") || KIND_LABEL[r.kind]}
                      </p>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{formatDate(r.issuedDate)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {formatDate(r.expiryDate)}
                      {r.status !== "AKTIF" && expiryHint(r.expiryDate) ? (
                        <span className="block text-xs text-muted-foreground">{expiryHint(r.expiryDate)}</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <CertificateBadge status={r.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1.5">
                        {r.originalFileName ? (
                          <Button
                            size="icon-sm"
                            variant="outline"
                            nativeButton={false}
                            render={<a href={`/api/sertifikasi/${r.publicId}/file`} target="_blank" rel="noopener noreferrer" aria-label="Lihat file sertifikat" />}
                          >
                            <Paperclip className="size-4" />
                          </Button>
                        ) : null}
                        <Button size="icon-sm" variant="outline" onClick={() => onEdit(r)} aria-label="Ubah">
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="outline"
                          className="text-destructive hover:text-destructive"
                          onClick={() => onDelete(r)}
                          aria-label="Hapus"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}

// ──────────────────────────── Jenis sertifikasi ────────────────────────────

function TypesTab({
  rows,
  onEdit,
  onDelete,
}: {
  rows: CertTypeRow[]
  onEdit: (row: CertTypeRow) => void
  onDelete: (row: CertTypeRow) => void
}) {
  if (rows.length === 0) {
    return (
      <Card className="py-0">
        <EmptyState
          title="Belum ada jenis sertifikasi"
          hint="Contoh: Sertifikasi Manajemen Risiko (wajib untuk jabatan tertentu), Pelatihan APU-PPT (wajib untuk semua pegawai). Masa berlaku dan jabatan yang wajib disesuaikan dengan ketentuan yang berlaku di perusahaan."
        />
      </Card>
    )
  }
  return (
    <Card className="gap-0 overflow-hidden py-0">
      <ul className="divide-y">
        {rows.map((t) => (
          <li key={t.publicId} className="grid gap-3 px-4 py-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <p className="font-medium">{t.name}</p>
                <Badge variant="secondary">{KIND_LABEL[t.kind]}</Badge>
                {!t.isActive ? <Badge variant="outline">Nonaktif</Badge> : null}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatValidity(t.validityMonths)}
                {t.validityMonths ? ` · diingatkan ${t.reminderDays} hari sebelumnya` : ""}
                {t.issuer ? ` · ${t.issuer}` : ""} · {t.certCount} sertifikat tercatat
              </p>
              <p className="mt-1 text-xs">
                <span className="text-muted-foreground">Wajib untuk: </span>
                {t.requiredForAll ? (
                  <span className="font-medium">Semua pegawai</span>
                ) : t.positionNames.length > 0 ? (
                  <span className="font-medium">{t.positionNames.join(", ")}</span>
                ) : (
                  <span className="text-muted-foreground">Tidak diwajibkan (opsional)</span>
                )}
              </p>
            </div>
            <div className="flex gap-1.5">
              <Button size="sm" variant="outline" onClick={() => onEdit(t)}>
                <Pencil className="size-4" />
                Ubah
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-destructive hover:text-destructive"
                onClick={() => onDelete(t)}
                aria-label={`Hapus ${t.name}`}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  )
}

// ─────────────────────────────── Dialog ───────────────────────────────

function ErrorBox({ message }: { message: string | null }) {
  return message ? <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{message}</p> : null
}

function Optional() {
  return <span className="font-normal text-muted-foreground">(opsional)</span>
}

function CertificateDialog({
  target,
  prefill,
  employeeOptions,
  types,
  onClose,
}: {
  target: CertRow | "new"
  prefill: { employee?: string; type?: string }
  employeeOptions: Option[]
  types: CertTypeRow[]
  onClose: () => void
}) {
  const row = target === "new" ? null : target
  const [employee, setEmployee] = useState(row?.employeePublicId ?? prefill.employee ?? "")
  const [typeId, setTypeId] = useState(row?.typePublicId ?? prefill.type ?? "")
  const [issuedDate, setIssuedDate] = useState(row?.issuedDate ?? "")
  const [expiryDate, setExpiryDate] = useState(row?.expiryDate ?? "")
  const [expiryTouched, setExpiryTouched] = useState(Boolean(row))
  const [file, setFile] = useState<File | null>(null)
  const [removeFile, setRemoveFile] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const type = types.find((t) => t.publicId === typeId)
  const typeOptions: Option[] = types.map((t) => ({ value: t.publicId, label: t.name }))

  // Tanggal kedaluwarsa otomatis = terbit + masa berlaku, selama admin belum mengubahnya sendiri.
  function recompute(nextIssued: string, nextType: CertTypeRow | undefined) {
    if (!expiryTouched) setExpiryDate(defaultExpiryDate(nextIssued, nextType?.validityMonths ?? null))
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    if (!employee) return setError("Pilih pegawai.")
    if (!typeId) return setError("Pilih jenis sertifikasi/pelatihan.")
    if (file && file.size > 5 * 1024 * 1024) return setError("Ukuran file sertifikat maksimal 5 MB.")
    const formData = new FormData(event.currentTarget)
    formData.set("employeePublicId", employee)
    formData.set("typePublicId", typeId)
    formData.set("issuedDate", issuedDate)
    formData.set("expiryDate", expiryDate)
    formData.delete("file")
    if (file) formData.set("file", file)
    if (removeFile && !file) formData.set("removeFile", "on")
    startTransition(async () => {
      const result = await saveEmployeeCertificationAction(row?.publicId ?? null, formData)
      if (result?.error) return setError(result.error)
      toast.success(row ? "Sertifikat diperbarui." : "Sertifikat ditambahkan.")
      onClose()
    })
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !isPending && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{row ? "Ubah Sertifikat" : "Tambah Sertifikat"}</DialogTitle>
          <DialogDescription>
            Catat sertifikat atau bukti pelatihan pegawai. Tanggal kedaluwarsa terisi otomatis dari masa berlaku jenisnya.
          </DialogDescription>
        </DialogHeader>
        <form id="cert-form" onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label>Pegawai</Label>
            <Select value={employee} onValueChange={(v) => setEmployee(String(v ?? ""))} items={employeeOptions}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Pilih pegawai" />
              </SelectTrigger>
              <SelectContent>
                {employeeOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Sertifikasi/Pelatihan</Label>
            <Select
              value={typeId}
              onValueChange={(v) => {
                const next = String(v ?? "")
                setTypeId(next)
                recompute(issuedDate, types.find((t) => t.publicId === next))
              }}
              items={typeOptions}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Pilih jenis" />
              </SelectTrigger>
              <SelectContent>
                {typeOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {type ? <p className="text-xs text-muted-foreground">Masa berlaku: {formatValidity(type.validityMonths)}</p> : null}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="certificateNumber">
                Nomor Sertifikat <Optional />
              </Label>
              <Input id="certificateNumber" name="certificateNumber" defaultValue={row?.certificateNumber ?? ""} maxLength={120} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="issuer">
                Penyelenggara <Optional />
              </Label>
              <Input id="issuer" name="issuer" defaultValue={row?.issuer ?? type?.issuer ?? ""} maxLength={191} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="issuedDate">Tanggal Terbit</Label>
              <Input
                id="issuedDate"
                type="date"
                required
                value={issuedDate}
                onChange={(e) => {
                  setIssuedDate(e.target.value)
                  recompute(e.target.value, type)
                }}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="expiryDate">Berlaku Sampai</Label>
              <Input
                id="expiryDate"
                type="date"
                value={expiryDate}
                onChange={(e) => {
                  setExpiryTouched(true)
                  setExpiryDate(e.target.value)
                }}
              />
              <p className="text-xs text-muted-foreground">Kosongkan bila berlaku selamanya.</p>
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="cert-file">
              File Sertifikat <Optional />
            </Label>
            <label
              htmlFor="cert-file"
              className="flex cursor-pointer items-center gap-3 rounded-md border border-dashed px-3 py-3 text-sm transition-colors hover:bg-muted/60"
            >
              <Upload className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">
                {file ? (
                  file.name
                ) : row?.originalFileName && !removeFile ? (
                  <span className="text-muted-foreground">Saat ini: {row.originalFileName}. Pilih file baru untuk mengganti.</span>
                ) : (
                  <span className="text-muted-foreground">PDF, JPG, atau PNG, maksimal 5 MB</span>
                )}
              </span>
            </label>
            <input
              id="cert-file"
              type="file"
              accept="application/pdf,image/png,image/jpeg"
              className="sr-only"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {row?.originalFileName && !file ? (
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <Checkbox checked={removeFile} onCheckedChange={(v) => setRemoveFile(v === true)} />
                Hapus file yang sekarang
              </label>
            ) : null}
            {row?.originalFileName && (file || removeFile) ? (
              <p className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
                <AlertTriangle className="mt-px size-3.5 shrink-0" />
                File lama ({row.originalFileName}) akan dihapus permanen setelah disimpan.
              </p>
            ) : null}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="notes">
              Catatan <Optional />
            </Label>
            <Textarea id="notes" name="notes" rows={2} defaultValue={row?.notes ?? ""} maxLength={2000} />
          </div>
          <ErrorBox message={error} />
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Batal
          </Button>
          <Button type="submit" form="cert-form" disabled={isPending}>
            {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const KIND_OPTIONS: Option[] = [
  { value: "SERTIFIKASI", label: "Sertifikasi" },
  { value: "PELATIHAN", label: "Pelatihan" },
]

function TypeDialog({
  target,
  positions,
  onClose,
}: {
  target: CertTypeRow | "new"
  positions: { id: number; name: string }[]
  onClose: () => void
}) {
  const row = target === "new" ? null : target
  const [kind, setKind] = useState<string>(row?.kind ?? "SERTIFIKASI")
  const [hasExpiry, setHasExpiry] = useState(row ? row.validityMonths !== null : true)
  const [requiredForAll, setRequiredForAll] = useState(row?.requiredForAll ?? false)
  const [positionIds, setPositionIds] = useState<number[]>(row?.positionIds ?? [])
  const [isActive, setIsActive] = useState(row?.isActive ?? true)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function togglePosition(id: number, checked: boolean) {
    setPositionIds((prev) => (checked ? [...prev, id] : prev.filter((p) => p !== id)))
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    const formData = new FormData(event.currentTarget)
    formData.set("kind", kind)
    if (!hasExpiry) formData.set("validityMonths", "0")
    else if (!Number(formData.get("validityMonths"))) return setError("Isi masa berlaku dalam bulan, atau pilih berlaku selamanya.")
    if (requiredForAll) formData.set("requiredForAll", "on")
    else positionIds.forEach((id) => formData.append("positionIds", String(id)))
    formData.set("isActive", isActive ? "on" : "off")
    startTransition(async () => {
      const result = await saveCertificationTypeAction(row?.publicId ?? null, formData)
      if (result?.error) return setError(result.error)
      toast.success(row ? "Jenis sertifikasi diperbarui." : "Jenis sertifikasi ditambahkan.")
      onClose()
    })
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !isPending && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{row ? "Ubah Jenis Sertifikasi" : "Tambah Jenis Sertifikasi"}</DialogTitle>
          <DialogDescription>Tentukan masa berlaku dan siapa yang wajib memilikinya.</DialogDescription>
        </DialogHeader>
        <form id="type-form" onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_10rem]">
            <div className="grid gap-2">
              <Label htmlFor="type-name">Nama</Label>
              <Input
                id="type-name"
                name="name"
                required
                maxLength={255}
                defaultValue={row?.name}
                placeholder="mis. Sertifikasi Manajemen Risiko Level 1"
              />
            </div>
            <div className="grid gap-2">
              <Label>Jenis</Label>
              <Select value={kind} onValueChange={(v) => setKind(String(v ?? "SERTIFIKASI"))} items={KIND_OPTIONS}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {KIND_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="type-issuer">
              Penyelenggara <Optional />
            </Label>
            <Input id="type-issuer" name="issuer" maxLength={191} defaultValue={row?.issuer ?? ""} placeholder="mis. LSP / lembaga pelatihan" />
          </div>

          <div className="grid gap-3 rounded-md border p-3">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={!hasExpiry} onCheckedChange={(v) => setHasExpiry(v !== true)} />
              Berlaku selamanya (tidak perlu diperpanjang)
            </label>
            {hasExpiry ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="validityMonths">Masa Berlaku (bulan)</Label>
                  <Input id="validityMonths" name="validityMonths" type="number" min={1} max={240} defaultValue={row?.validityMonths ?? 36} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="reminderDays">Ingatkan (hari sebelum)</Label>
                  <Input id="reminderDays" name="reminderDays" type="number" min={1} max={365} defaultValue={row?.reminderDays ?? 90} />
                </div>
              </div>
            ) : null}
          </div>

          <div className="grid gap-3 rounded-md border p-3">
            <p className="text-sm font-medium">Wajib untuk</p>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={requiredForAll} onCheckedChange={(v) => setRequiredForAll(v === true)} />
              Semua pegawai aktif
            </label>
            {!requiredForAll ? (
              <>
                <p className="text-xs text-muted-foreground">
                  Atau pilih jabatan tertentu. Kosongkan semua bila tidak wajib (hanya dicatat).
                </p>
                <div className="grid max-h-48 gap-1.5 overflow-y-auto sm:grid-cols-2">
                  {positions.map((p) => (
                    <label key={p.id} className="flex items-center gap-2 text-sm">
                      <Checkbox checked={positionIds.includes(p.id)} onCheckedChange={(v) => togglePosition(p.id, v === true)} />
                      <span className="truncate">{p.name}</span>
                    </label>
                  ))}
                </div>
              </>
            ) : null}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="type-description">
              Keterangan <Optional />
            </Label>
            <Textarea
              id="type-description"
              name="description"
              rows={2}
              maxLength={2000}
              defaultValue={row?.description ?? ""}
              placeholder="Dasar ketentuan, mis. nomor peraturan yang mewajibkan"
            />
          </div>

          {row ? (
            <label className="flex items-start gap-2 text-sm">
              <Checkbox checked={isActive} onCheckedChange={(v) => setIsActive(v === true)} className="mt-0.5" />
              <span>
                Aktif
                <span className="block text-xs text-muted-foreground">
                  Jenis nonaktif tidak dihitung di rekap kepatuhan dan tidak dikirimi pengingat, tetapi sertifikat lamanya tetap tersimpan.
                </span>
              </span>
            </label>
          ) : null}
          <ErrorBox message={error} />
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Batal
          </Button>
          <Button type="submit" form="type-form" disabled={isPending}>
            {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function DeleteDialog({
  target,
  onClose,
}: {
  target: { kind: "cert"; row: CertRow } | { kind: "type"; row: CertTypeRow }
  onClose: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const isCert = target.kind === "cert"

  function handleDelete() {
    startTransition(async () => {
      const result = isCert
        ? await deleteEmployeeCertificationAction(target.row.publicId)
        : await deleteCertificationTypeAction(target.row.publicId)
      if (result?.error) {
        toast.error(result.error)
        return
      }
      toast.success(isCert ? "Sertifikat dihapus." : "Jenis sertifikasi dihapus.")
      onClose()
    })
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !isPending && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isCert ? "Hapus sertifikat?" : "Hapus jenis sertifikasi?"}</DialogTitle>
          <DialogDescription>Tindakan ini tidak bisa dibatalkan.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 text-sm">
          <div className="flex items-start gap-3 rounded-md border px-3 py-2.5">
            <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            {target.kind === "cert" ? (
              <div>
                <p className="font-medium">{target.row.typeName}</p>
                <p className="text-xs text-muted-foreground">
                  {target.row.employeeName} · terbit {formatDate(target.row.issuedDate)}
                </p>
              </div>
            ) : (
              <div>
                <p className="font-medium">{target.row.name}</p>
                <p className="text-xs text-muted-foreground">{target.row.certCount} sertifikat tercatat</p>
              </div>
            )}
          </div>
          {target.kind === "cert" && target.row.originalFileName ? (
            <p className="flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2 text-destructive">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              File sertifikat ({target.row.originalFileName}) ikut dihapus permanen dari server.
            </p>
          ) : null}
          {target.kind === "type" && target.row.certCount > 0 ? (
            <p className="flex items-start gap-2 rounded-md bg-amber-50 px-3 py-2 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              Jenis ini masih dipakai {target.row.certCount} sertifikat sehingga tidak bisa dihapus. Ubah menjadi nonaktif agar riwayatnya tetap tersimpan.
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Batal
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isPending || (target.kind === "type" && target.row.certCount > 0)}
          >
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
            Hapus Permanen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
