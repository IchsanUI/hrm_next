"use client"

import { useMemo, useState, useTransition } from "react"
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { MEMO_STEP_TYPE_LABEL, type MemoStepTypeValue } from "@/lib/health-claim-labels"
import { saveMemoFlowAction, saveMemoFormatAction } from "@/server/actions/health-claim-settings"

export type MemoFlowStepRow = {
  type: MemoStepTypeValue
  label: string
  approverEmployeeId: number | null
  canAdjust: boolean
}
export type MemoFormat = {
  memoTo: string
  memoFrom: string
  memoSubject: string
  memoOpening: string
  memoClosing: string
  memoLetterNumberFormat: string
}
type Candidate = { id: number; name: string; position: string }

const TYPE_OPTIONS = (Object.keys(MEMO_STEP_TYPE_LABEL) as MemoStepTypeValue[]).map((v) => ({
  value: v,
  label: MEMO_STEP_TYPE_LABEL[v],
}))

const TYPE_HINT: Record<MemoStepTypeValue, string> = {
  ATASAN_LANGSUNG: "Atasan dari petugas yang membuat Nota Dinas (dari data Struktur Organisasi).",
  KEPALA_DEPARTEMEN: "Kepala bagian dari petugas yang membuat Nota Dinas.",
  PEGAWAI_TERTENTU: "Pejabat tertentu yang dipilih di bawah.",
  DISPOSISI_DIREKTUR: "Direktur memberi disposisi: setuju, setuju dengan catatan, tinjau ulang, atau tidak disetujui.",
}

function FlowEditor({ initial, candidates }: { initial: MemoFlowStepRow[]; candidates: Candidate[] }) {
  const [steps, setSteps] = useState<(MemoFlowStepRow & { key: number })[]>(() =>
    initial.map((s, i) => ({ ...s, key: i + 1 }))
  )
  const [isPending, startTransition] = useTransition()
  const employeeOptions = useMemo(
    () => candidates.map((c) => ({ value: String(c.id), label: `${c.name} — ${c.position}` })),
    [candidates]
  )
  const update = (key: number, patch: Partial<MemoFlowStepRow>) =>
    setSteps((prev) => prev.map((s) => (s.key === key ? { ...s, ...patch } : s)))
  const move = (index: number, dir: -1 | 1) =>
    setSteps((prev) => {
      const next = [...prev]
      const [item] = next.splice(index, 1)
      next.splice(index + dir, 0, item)
      return next
    })
  const hasDisposition = steps.some((s) => s.type === "DISPOSISI_DIREKTUR")

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Alur Persetujuan Nota Dinas</CardTitle>
        <CardDescription>
          Urutan persetujuan setelah petugas membuat Nota Dinas. Perubahan hanya berlaku untuk Nota Dinas berikutnya.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 pt-2">
        {!hasDisposition ? (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
            Belum ada langkah Disposisi Direktur. Tambahkan agar Nota Dinas mendapat disposisi Direksi.
          </p>
        ) : null}
        <ol className="grid gap-3">
          {steps.map((s, i) => {
            const needsApprover = s.type === "PEGAWAI_TERTENTU" || s.type === "DISPOSISI_DIREKTUR"
            return (
              <li key={s.key} className="rounded-lg border p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold">Langkah {i + 1}</span>
                  <div className="flex gap-1">
                    <Button size="icon-sm" variant="ghost" aria-label="Naikkan" disabled={i === 0} onClick={() => move(i, -1)}>
                      <ArrowUp className="size-4" />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label="Turunkan"
                      disabled={i === steps.length - 1}
                      onClick={() => move(i, 1)}
                    >
                      <ArrowDown className="size-4" />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label="Hapus langkah"
                      onClick={() => setSteps((prev) => prev.filter((x) => x.key !== s.key))}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                </div>
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-1.5">
                    <Label>Jenis</Label>
                    <Select
                      value={s.type}
                      onValueChange={(v) => update(s.key, { type: (v ?? "PEGAWAI_TERTENTU") as MemoStepTypeValue })}
                      items={TYPE_OPTIONS}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TYPE_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">{TYPE_HINT[s.type]}</p>
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Label di surat</Label>
                    <Input
                      value={s.label}
                      placeholder="mis. Kabag Personalia, Umum & IT"
                      onChange={(e) => update(s.key, { label: e.target.value })}
                    />
                  </div>
                  {needsApprover ? (
                    <div className="grid gap-1.5 sm:col-span-2">
                      <Label>{s.type === "DISPOSISI_DIREKTUR" ? "Direktur" : "Pegawai"}</Label>
                      <Select
                        value={s.approverEmployeeId ? String(s.approverEmployeeId) : ""}
                        onValueChange={(v) => update(s.key, { approverEmployeeId: v ? Number(v) : null })}
                        items={employeeOptions}
                      >
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
                  ) : null}
                  <label className="flex items-center gap-2 text-sm sm:col-span-2">
                    <Switch checked={s.canAdjust} onCheckedChange={(v) => update(s.key, { canAdjust: v })} />
                    Boleh menurunkan nominal atau mengeluarkan klaim dari Nota Dinas
                  </label>
                </div>
              </li>
            )
          })}
        </ol>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={steps.length >= 10}
            onClick={() =>
              setSteps((prev) => [
                ...prev,
                { key: Date.now(), type: "PEGAWAI_TERTENTU", label: "", approverEmployeeId: null, canAdjust: false },
              ])
            }
          >
            <Plus className="size-4" />
            Tambah langkah
          </Button>
          <Button
            size="sm"
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                const result = await saveMemoFlowAction(
                  steps.map(({ type, label, approverEmployeeId, canAdjust }) => ({ type, label, approverEmployeeId, canAdjust }))
                )
                if ("error" in result) toast.error(result.error)
                else toast.success(result.success)
              })
            }
          >
            Simpan Alur
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function FormatEditor({ initial }: { initial: MemoFormat }) {
  const [form, setForm] = useState(initial)
  const [isPending, startTransition] = useTransition()
  const set = (k: keyof MemoFormat) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [k]: e.target.value }))

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Format Surat</CardTitle>
        <CardDescription>Teks bawaan Nota Dinas. Petugas masih bisa menyunting teks pembuka dan penutup per Nota Dinas.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 pt-2">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="memoTo">Kepada</Label>
            <Input id="memoTo" value={form.memoTo} onChange={set("memoTo")} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="memoFrom">Dari</Label>
            <Input id="memoFrom" value={form.memoFrom} onChange={set("memoFrom")} />
          </div>
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="memoSubject">Perihal</Label>
            <Input id="memoSubject" value={form.memoSubject} onChange={set("memoSubject")} />
          </div>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="memoOpening">Teks pembuka</Label>
          <Textarea id="memoOpening" rows={4} value={form.memoOpening} onChange={set("memoOpening")} />
          <p className="text-xs text-muted-foreground">
            <code>{"{total}"}</code> diganti nominal (mis. Rp.2.691.037,-) dan <code>{"{terbilang}"}</code> diganti
            terbilangnya.
          </p>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="memoClosing">Teks penutup</Label>
          <Textarea id="memoClosing" rows={3} value={form.memoClosing} onChange={set("memoClosing")} />
        </div>
        <div className="grid gap-1.5 sm:max-w-md">
          <Label htmlFor="memoNumber">Format nomor surat (opsional)</Label>
          <Input
            id="memoNumber"
            placeholder="mis. {no}/ND/PUI/{bulan_romawi}/{tahun}"
            value={form.memoLetterNumberFormat}
            onChange={set("memoLetterNumberFormat")}
          />
          <p className="text-xs text-muted-foreground">
            Kosongkan bila Nota Dinas tidak memakai nomor surat. Tersedia <code>{"{no}"}</code>,{" "}
            <code>{"{bulan_romawi}"}</code>, <code>{"{bulan}"}</code>, <code>{"{tahun}"}</code>.
          </p>
        </div>
        <div>
          <Button
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                const result = await saveMemoFormatAction(form)
                if ("error" in result) toast.error(result.error)
                else toast.success(result.success)
              })
            }
          >
            Simpan Format
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export function HealthClaimMemoSettings({
  flow,
  format,
  candidates,
}: {
  flow: MemoFlowStepRow[]
  format: MemoFormat
  candidates: Candidate[]
}) {
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <FlowEditor initial={flow} candidates={candidates} />
      <FormatEditor initial={format} />
    </div>
  )
}
