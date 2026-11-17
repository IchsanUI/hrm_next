"use client"

import { useMemo, useState, useTransition } from "react"
import { Pencil, Plus, Search, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsList, TabsPanel, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { MONTH_NAMES, plafonPeriodLabel } from "@/lib/health-claim-labels"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { HealthClaimMemoSettings, type MemoFlowStepRow, type MemoFormat } from "@/components/health-claim-memo-settings"
import {
  deleteClaimTypeAction,
  saveClaimTypeAction,
  saveEligibleStatusesAction,
  saveHealthClaimGeneralAction,
  saveHealthClaimStaffAction,
  savePlafonsAction,
  type SettingsActionResult,
} from "@/server/actions/health-claim-settings"

export type StaffCandidate = { id: number; name: string; position: string; hasAccount: boolean }
export type ClaimTypeRow = {
  publicId: string
  name: string
  description: string | null
  requiredDocumentLabel: string | null
  isActive: boolean
  sortOrder: number
  claimCount: number
}
export type PlafonRow = { positionId: number; positionName: string; employeeCount: number; amount: number | null }
export type StatusRow = { id: number; name: string; employeeCount: number; eligible: boolean }

type Props = {
  general: { minEmployeesPerMemo: number; submissionDeadlineDays: number | null; plafonStartMonth: number }
  candidates: StaffCandidate[]
  petugasIds: number[]
  accountingIds: number[]
  types: ClaimTypeRow[]
  plafons: PlafonRow[]
  statuses: StatusRow[]
  memoFlow: MemoFlowStepRow[]
  memoFormat: MemoFormat
}

function useAction() {
  const [isPending, startTransition] = useTransition()
  const run = (fn: () => Promise<SettingsActionResult>, onSuccess?: () => void) =>
    startTransition(async () => {
      const result = await fn()
      if ("error" in result) toast.error(result.error)
      else {
        toast.success(result.success)
        onSuccess?.()
      }
    })
  return { isPending, run }
}

// ── Umum ─────────────────────────────────────────────
function GeneralSettings({ general }: { general: Props["general"] }) {
  const { isPending, run } = useAction()
  const [minEmployees, setMinEmployees] = useState(String(general.minEmployeesPerMemo))
  const [deadlineEnabled, setDeadlineEnabled] = useState(general.submissionDeadlineDays !== null)
  const [deadlineDays, setDeadlineDays] = useState(String(general.submissionDeadlineDays ?? 30))
  const [startMonth, setStartMonth] = useState(String(general.plafonStartMonth))
  const startMonthNum = Number(startMonth)
  const exampleYear = new Date().getFullYear()

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Pengaturan Umum</CardTitle>
        <CardDescription>Aturan dasar pengajuan dan pembuatan Nota Dinas.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 pt-2 sm:max-w-xl">
        <div className="grid gap-1.5">
          <Label htmlFor="minEmployees">Minimal klaim per Nota Dinas</Label>
          <Input
            id="minEmployees"
            type="number"
            min={1}
            max={100}
            className="w-32"
            value={minEmployees}
            onChange={(e) => setMinEmployees(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Klaim terkonfirmasi ditahan sampai terkumpul sekian klaim, baru Nota Dinas bisa dibuat. Beberapa klaim dari pegawai
            yang sama dihitung masing-masing.
          </p>
        </div>

        <div className="grid gap-1.5">
          <Label>Awal periode plafon</Label>
          <Select value={startMonth} onValueChange={(v) => setStartMonth(String(v ?? "1"))} items={MONTH_OPTIONS}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTH_OPTIONS.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Sisa plafon direset setiap tanggal 1 bulan ini. Contoh periode berjalan:{" "}
            <span className="font-medium text-foreground">
              {plafonPeriodLabel(exampleYear, startMonthNum)}
            </span>
            . Klaim masuk periode sesuai tanggal berobat; mengubah pengaturan ini ikut menyesuaikan periode klaim yang
            sudah ada.
          </p>
        </div>

        <div className="grid gap-2">
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label>Batas waktu pengajuan</Label>
              <p className="text-xs text-muted-foreground">
                Klaim harus diajukan paling lambat sekian hari setelah tanggal berobat.
              </p>
            </div>
            <Switch checked={deadlineEnabled} onCheckedChange={setDeadlineEnabled} />
          </div>
          {deadlineEnabled ? (
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                max={365}
                className="w-32"
                value={deadlineDays}
                onChange={(e) => setDeadlineDays(e.target.value)}
                aria-label="Batas hari pengajuan"
              />
              <span className="text-sm text-muted-foreground">hari setelah tanggal berobat</span>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Tidak dibatasi.</p>
          )}
        </div>

        <div>
          <Button
            disabled={isPending}
            onClick={() =>
              run(() =>
                saveHealthClaimGeneralAction({
                  minEmployeesPerMemo: Number(minEmployees),
                  deadlineEnabled,
                  submissionDeadlineDays: Number(deadlineDays),
                  plafonStartMonth: startMonthNum,
                })
              )
            }
          >
            Simpan
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

const MONTH_OPTIONS = MONTH_NAMES.map((name, i) => ({ value: String(i + 1), label: name }))

// ── Petugas & Accounting ─────────────────────────────
function StaffPicker({
  title,
  description,
  role,
  candidates,
  initialIds,
}: {
  title: string
  description: string
  role: "PETUGAS" | "ACCOUNTING"
  candidates: StaffCandidate[]
  initialIds: number[]
}) {
  const { isPending, run } = useAction()
  const [selected, setSelected] = useState(() => new Set(initialIds))
  const [query, setQuery] = useState("")

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = q
      ? candidates.filter((c) => c.name.toLowerCase().includes(q) || c.position.toLowerCase().includes(q))
      : candidates
    // Yang terpilih selalu di atas supaya mudah dicek.
    return [...list].sort((a, b) => Number(selected.has(b.id)) - Number(selected.has(a.id)))
  }, [candidates, query, selected])

  const selectedNames = candidates.filter((c) => selected.has(c.id))

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 pt-2">
        <div className="flex min-h-7 flex-wrap gap-1.5">
          {selectedNames.length === 0 ? (
            <span className="text-sm text-muted-foreground">Belum ada yang ditunjuk.</span>
          ) : (
            selectedNames.map((c) => (
              <Badge key={c.id} variant="secondary">
                {c.name}
              </Badge>
            ))
          )}
        </div>
        <div className="relative">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Cari nama atau jabatan..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="max-h-64 overflow-y-auto rounded-md border">
          {filtered.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">Tidak ada pegawai yang cocok.</p>
          ) : (
            filtered.map((c) => (
              <label
                key={c.id}
                className="flex cursor-pointer items-center gap-2.5 border-b px-3 py-2 text-sm last:border-b-0 hover:bg-muted/50"
              >
                <Checkbox
                  checked={selected.has(c.id)}
                  onCheckedChange={(v) =>
                    setSelected((prev) => {
                      const next = new Set(prev)
                      if (v === true) next.add(c.id)
                      else next.delete(c.id)
                      return next
                    })
                  }
                />
                <span className="min-w-0 flex-1">
                  <span className="font-medium">{c.name}</span>
                  <span className="text-muted-foreground"> · {c.position}</span>
                </span>
                {!c.hasAccount ? (
                  <span className="text-xs text-amber-600 dark:text-amber-400">belum punya akun</span>
                ) : null}
              </label>
            ))
          )}
        </div>
        <div>
          <Button disabled={isPending} onClick={() => run(() => saveHealthClaimStaffAction(role, [...selected]))}>
            Simpan
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Jenis Klaim ──────────────────────────────────────
function TypeDialog({ row, onClose }: { row: ClaimTypeRow | null; onClose: () => void }) {
  const { isPending, run } = useAction()
  const [name, setName] = useState(row?.name ?? "")
  const [description, setDescription] = useState(row?.description ?? "")
  const [requiredDocumentLabel, setRequiredDocumentLabel] = useState(row?.requiredDocumentLabel ?? "")
  const [isActive, setIsActive] = useState(row?.isActive ?? true)
  const [sortOrder, setSortOrder] = useState(String(row?.sortOrder ?? 0))

  return (
    <Dialog open onOpenChange={(open) => !open && !isPending && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{row ? "Ubah Jenis Klaim" : "Tambah Jenis Klaim"}</DialogTitle>
          <DialogDescription>Kuitansi/nota selalu wajib. Tambahkan bukti lain bila jenis ini memerlukannya.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="typeName">Nama jenis klaim</Label>
            <Input id="typeName" value={name} onChange={(e) => setName(e.target.value)} placeholder="mis. Rawat Jalan" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="typeDoc">Bukti wajib selain kuitansi (opsional)</Label>
            <Input
              id="typeDoc"
              value={requiredDocumentLabel}
              onChange={(e) => setRequiredDocumentLabel(e.target.value)}
              placeholder="mis. Resep dokter"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="typeDesc">Keterangan untuk pegawai (opsional)</Label>
            <Textarea id="typeDesc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="flex flex-wrap items-end gap-6">
            <div className="grid gap-1.5">
              <Label htmlFor="typeOrder">Urutan</Label>
              <Input
                id="typeOrder"
                type="number"
                min={0}
                className="w-24"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
              />
            </div>
            <label className="flex items-center gap-2 pb-2 text-sm">
              <Switch checked={isActive} onCheckedChange={setIsActive} />
              Aktif (bisa dipilih pegawai)
            </label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Batal
          </Button>
          <Button
            disabled={isPending}
            onClick={() =>
              run(
                () =>
                  saveClaimTypeAction(row?.publicId ?? null, {
                    name,
                    description,
                    requiredDocumentLabel,
                    isActive,
                    sortOrder: Number(sortOrder) || 0,
                  }),
                onClose
              )
            }
          >
            Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ClaimTypes({ types }: { types: ClaimTypeRow[] }) {
  const { isPending, run } = useAction()
  const [editing, setEditing] = useState<ClaimTypeRow | null | "new">(null)

  return (
    <Card>
      <CardHeader className="border-b">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>Jenis Klaim</CardTitle>
            <CardDescription>Pilihan jenis klaim di formulir pegawai, beserta bukti yang wajib dilampirkan.</CardDescription>
          </div>
          <Button size="sm" onClick={() => setEditing("new")}>
            <Plus className="size-4" />
            Tambah
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Jenis</th>
                <th className="px-3 py-2 font-medium">Bukti wajib</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 text-right font-medium">Dipakai</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {types.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                    Belum ada jenis klaim.
                  </td>
                </tr>
              ) : (
                types.map((t) => (
                  <tr key={t.publicId} className="border-t">
                    <td className="px-3 py-2.5">
                      <span className="font-medium">{t.name}</span>
                      {t.description ? <span className="block text-xs text-muted-foreground">{t.description}</span> : null}
                    </td>
                    <td className="px-3 py-2.5">
                      Kuitansi{t.requiredDocumentLabel ? ` + ${t.requiredDocumentLabel}` : ""}
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge variant={t.isActive ? "secondary" : "outline"}>{t.isActive ? "Aktif" : "Nonaktif"}</Badge>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{t.claimCount}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex justify-end gap-1">
                        <Button size="icon-sm" variant="ghost" aria-label={`Ubah ${t.name}`} onClick={() => setEditing(t)}>
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label={`Hapus ${t.name}`}
                          disabled={isPending}
                          onClick={() => {
                            if (window.confirm(`Hapus jenis klaim "${t.name}"?`)) run(() => deleteClaimTypeAction(t.publicId))
                          }}
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
      {editing ? <TypeDialog row={editing === "new" ? null : editing} onClose={() => setEditing(null)} /> : null}
    </Card>
  )
}

// ── Plafon per Jabatan ───────────────────────────────
function parseAmount(raw: string): number | null {
  const digits = raw.replace(/\D/g, "")
  return digits ? Number(digits) : null
}

function Plafons({ plafons }: { plafons: PlafonRow[] }) {
  const { isPending, run } = useAction()
  const [values, setValues] = useState<Record<number, string>>(() =>
    Object.fromEntries(plafons.map((p) => [p.positionId, p.amount === null ? "" : p.amount.toLocaleString("id-ID")]))
  )
  const unset = plafons.filter((p) => !parseAmount(values[p.positionId] ?? "") && p.employeeCount > 0).length

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Plafon per Jabatan</CardTitle>
        <CardDescription>
          Plafon klaim per tahun sesuai SK, dipakai bersama oleh pegawai dan keluarganya. Jabatan yang plafonnya
          kosong tidak bisa mengajukan klaim.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 pt-2">
        {unset > 0 ? (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
            {unset} jabatan yang memiliki pegawai belum diberi plafon.
          </p>
        ) : null}
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Jabatan</th>
                <th className="px-3 py-2 text-right font-medium">Pegawai</th>
                <th className="px-3 py-2 font-medium">Plafon per tahun (Rp)</th>
              </tr>
            </thead>
            <tbody>
              {plafons.map((p) => (
                <tr key={p.positionId} className="border-t">
                  <td className="px-3 py-2 font-medium">{p.positionName}</td>
                  <td className="px-3 py-2 text-right text-muted-foreground tabular-nums">{p.employeeCount}</td>
                  <td className="px-3 py-1.5">
                    <Input
                      inputMode="numeric"
                      className="h-8 w-44 text-right tabular-nums"
                      placeholder="Belum diatur"
                      aria-label={`Plafon ${p.positionName}`}
                      value={values[p.positionId] ?? ""}
                      onChange={(e) => {
                        const amount = parseAmount(e.target.value)
                        setValues((prev) => ({
                          ...prev,
                          [p.positionId]: amount === null ? "" : amount.toLocaleString("id-ID"),
                        }))
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <Button
            disabled={isPending}
            onClick={() =>
              run(() =>
                savePlafonsAction(
                  plafons.map((p) => ({ positionId: p.positionId, amount: parseAmount(values[p.positionId] ?? "") }))
                )
              )
            }
          >
            Simpan Plafon
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Status Berhak ────────────────────────────────────
function EligibleStatuses({ statuses }: { statuses: StatusRow[] }) {
  const { isPending, run } = useAction()
  const [selected, setSelected] = useState(() => new Set(statuses.filter((s) => s.eligible).map((s) => s.id)))

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Status Kepegawaian yang Berhak</CardTitle>
        <CardDescription>
          Hanya pegawai dengan status yang dicentang yang bisa mengajukan klaim. Status baru otomatis tidak berhak
          sampai dicentang.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 pt-2 sm:max-w-md">
        <div className="rounded-md border">
          {statuses.map((s) => (
            <label key={s.id} className="flex cursor-pointer items-center gap-2.5 border-b px-3 py-2.5 text-sm last:border-b-0">
              <Checkbox
                checked={selected.has(s.id)}
                onCheckedChange={(v) =>
                  setSelected((prev) => {
                    const next = new Set(prev)
                    if (v === true) next.add(s.id)
                    else next.delete(s.id)
                    return next
                  })
                }
              />
              <span className="flex-1 font-medium">{s.name}</span>
              <span className="text-xs text-muted-foreground tabular-nums">{s.employeeCount} pegawai</span>
            </label>
          ))}
        </div>
        <div>
          <Button disabled={isPending} onClick={() => run(() => saveEligibleStatusesAction([...selected]))}>
            Simpan
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export function HealthClaimSettingsManager(props: Props) {
  const plafonTotal = props.plafons.filter((p) => p.amount !== null)
  return (
    <Tabs defaultValue="umum">
      <TabsList className="flex-wrap">
        <TabsTrigger value="umum">Umum</TabsTrigger>
        <TabsTrigger value="petugas">Petugas & Accounting</TabsTrigger>
        <TabsTrigger value="jenis">Jenis Klaim</TabsTrigger>
        <TabsTrigger value="plafon">Plafon per Jabatan</TabsTrigger>
        <TabsTrigger value="status">Status Berhak</TabsTrigger>
        <TabsTrigger value="nota-dinas">Nota Dinas</TabsTrigger>
      </TabsList>
      <TabsPanel value="umum" className="grid gap-6">
        <GeneralSettings general={props.general} />
      </TabsPanel>
      <TabsPanel value="petugas" className="grid gap-6 lg:grid-cols-2">
        <StaffPicker
          title="Petugas Klaim"
          description="Memeriksa dan mengonfirmasi klaim pegawai, lalu membuat Nota Dinas. Cukup salah satu yang bertindak. Petugas mendapat menu Pemeriksaan Klaim di portal pegawai, tanpa perlu akses admin."
          role="PETUGAS"
          candidates={props.candidates}
          initialIds={props.petugasIds}
        />
        <StaffPicker
          title="Accounting"
          description="Melihat Nota Dinas final yang sudah didisposisi langsung di HRIS tanpa cetakan, lalu mencatat pembayaran."
          role="ACCOUNTING"
          candidates={props.candidates}
          initialIds={props.accountingIds}
        />
      </TabsPanel>
      <TabsPanel value="jenis">
        <ClaimTypes types={props.types} />
      </TabsPanel>
      <TabsPanel value="plafon">
        <Plafons plafons={props.plafons} />
        <p className="mt-2 text-xs text-muted-foreground">
          {plafonTotal.length} dari {props.plafons.length} jabatan sudah diberi plafon.
        </p>
      </TabsPanel>
      <TabsPanel value="status">
        <EligibleStatuses statuses={props.statuses} />
      </TabsPanel>
      <TabsPanel value="nota-dinas">
        <HealthClaimMemoSettings flow={props.memoFlow} format={props.memoFormat} candidates={props.candidates} />
      </TabsPanel>
    </Tabs>
  )
}
