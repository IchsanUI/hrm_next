"use client"

import { useActionState, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { ArrowDown, ArrowUp, Info, Pencil, Plus, Trash2, Zap } from "lucide-react"

import { LEAVE_TYPES, type LeaveTypeOption } from "@/lib/leave-types"
import { APPROVER_TYPE_LABEL } from "@/lib/approval-step-labels"
import {
  saveApprovalFlowAction,
  type ApprovalFlowActionState,
} from "@/server/actions/approval-flow"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export type ApprovalStepValue = {
  approverType:
    | "ATASAN_LANGSUNG"
    | "KEPALA_DEPARTEMEN"
    | "DIREKSI"
    | "HR"
    | "PEGAWAI_PENGGANTI"
    | "PEGAWAI_TERTENTU"
  unlockAfter: boolean
  approverEmployeeId: number | null
  approverEmployeeName?: string | null
}

type Employee = { id: number; fullName: string; isDireksi: boolean }

const APPROVER_TYPE_OPTIONS = (
  [
    "ATASAN_LANGSUNG",
    "KEPALA_DEPARTEMEN",
    "PEGAWAI_PENGGANTI",
    "HR",
    "DIREKSI",
    "PEGAWAI_TERTENTU",
  ] as const
).map((value) => ({ value, label: APPROVER_TYPE_LABEL[value] }))

const TYPES_REQUIRING_EMPLOYEE: ApprovalStepValue["approverType"][] = ["DIREKSI", "PEGAWAI_TERTENTU"]

const AUTO_SKIP_TYPES: ApprovalStepValue["approverType"][] = ["ATASAN_LANGSUNG", "KEPALA_DEPARTEMEN"]

// Catatan khusus per jenis izin — alur asimetris yang tidak terbaca cukup jelas
// cuma dari daftar step, perlu dijelaskan eksplisit ke admin.
const LEAVE_TYPE_NOTES: Partial<Record<string, string>> = {
  IZIN_MENINGGALKAN_KANTOR:
    "Step Direksi cuma aktif kalau pemohonnya sendiri Kepala Departemen (menggantikan step Kepala Departemen yang dilewati). Untuk pegawai biasa, approval Kepala Departemen saja sudah cukup — Direksi tidak pernah ikut approve.",
  IZIN_SAKIT:
    "Step Pegawai Pengganti bukan approval biasa — kalau pengganti menyatakan tidak bersedia, pengajuan TIDAK ditolak/gagal. Statusnya jadi \"Perlu Revisi\" dan dikembalikan ke pemohon untuk memilih pengganti baru, lalu alur lanjut lagi dari step ini juga (tidak mengulang dari Kepala Departemen).",
  IZIN_CUTI:
    "Step Pegawai Pengganti sifatnya sama seperti Izin Sakit (boleh menyatakan tidak bersedia, tidak menggagalkan pengajuan). Step Pegawai Tertentu di alur ini dipakai sebagai checkpoint tambahan (mis. HR) — HANYA aktif kalau durasi cuti lebih dari 3 hari; untuk pengajuan 3 hari atau kurang, step ini otomatis dilewati. Pengajuan >3 hari juga wajib melampirkan dokumen pendukung saat mengajukan.",
  CUTI_BERSALIN:
    "Step Pegawai Pengganti sifatnya sama seperti Izin Sakit/Izin Cuti (boleh menyatakan tidak bersedia, tidak menggagalkan pengajuan). Tanggal cuti dihitung otomatis dari HPL/tanggal kejadian (Pasal 37) — bukan Izin Cuti biasa, jadi TIDAK memotong saldo Cuti Tahunan pegawai. Surat keterangan dokter wajib dilampirkan saat pengajuan.",
  CUTI_KHUSUS_HAJI_UMROH:
    "Step Pegawai Pengganti sifatnya sama seperti jenis izin lain (boleh menyatakan tidak bersedia, tidak menggagalkan pengajuan). Masing-masing jenis (Haji/Umroh) cuma boleh diambil 1x seumur bekerja (Pasal 41) — sistem otomatis memblokir pengajuan ke-2, kecuali admin membuka pengecualian per pegawai lewat Detail Pegawai. Bukti pendaftaran/surat panggilan wajib dilampirkan saat pengajuan.",
  DISPENSASI:
    "Step Pegawai Pengganti sifatnya sama seperti jenis izin lain (boleh menyatakan tidak bersedia, tidak menggagalkan pengajuan). Sesuai Pasal 44: gaji penuh, TIDAK memotong saldo Cuti Tahunan. Durasi mengikuti kategori kejadian yang dipilih pemohon (tetap 1—3 hari, atau \"waktu wajar\" untuk 4 kategori terakhir yang dinilai langsung oleh approver). Dokumen pendukung opsional, tidak diwajibkan pasal.",
  CUTI_BESAR:
    "Step Pegawai Pengganti sifatnya sama seperti jenis izin lain (boleh menyatakan tidak bersedia, tidak menggagalkan pengajuan). Sesuai Pasal 38: maksimal 2x seumur bekerja, masing-masing tetap 1 bulan — pengajuan ke-1 butuh masa kerja ≥6 tahun, pengajuan ke-2 butuh masa kerja ≥7 tahun DAN pengajuan pertama sudah APPROVED. Kalau pegawai perlu pengecualian di atas 2x, admin bisa membukanya lewat Detail Pegawai. Cuti Tahunan pegawai di tahun yang sama otomatis tidak berlaku (lihat Saldo Cuti Pegawai).",
  CUTI_DI_LUAR_TANGGUNGAN:
    "Step Pegawai Pengganti sifatnya sama seperti jenis izin lain (boleh menyatakan tidak bersedia, tidak menggagalkan pengajuan). Sesuai Pasal 39: hanya untuk pegawai masa kerja ≥10 tahun terus-menerus, wajib diajukan minimal 1 bulan sebelum tanggal mulai, dan maksimal 3 bulan. Periode ini tidak dihitung sebagai masa kerja, tidak mendapat gaji/tunjangan, dan pegawai dibebastugaskan dari jabatan sebelumnya — TIDAK memengaruhi saldo Cuti Tahunan (beda dengan Cuti Besar).",
}

const DEFAULT_STEPS: ApprovalStepValue[] = [
  { approverType: "ATASAN_LANGSUNG", unlockAfter: true, approverEmployeeId: null },
]

function stepDisplayLabel(step: ApprovalStepValue) {
  if (TYPES_REQUIRING_EMPLOYEE.includes(step.approverType) && step.approverEmployeeName) {
    return `${APPROVER_TYPE_LABEL[step.approverType]} (${step.approverEmployeeName})`
  }
  return APPROVER_TYPE_LABEL[step.approverType]
}

export function ApprovalFlowCard({
  leaveTypeValue,
  initialSteps,
  employees,
}: {
  leaveTypeValue: string
  initialSteps: ApprovalStepValue[]
  employees: Employee[]
}) {
  const leaveType = LEAVE_TYPES.find((t) => t.value === leaveTypeValue) as LeaveTypeOption
  const [editing, setEditing] = useState(false)
  const [steps, setSteps] = useState<ApprovalStepValue[]>(initialSteps)
  const [state, formAction, isPending] = useActionState<
    ApprovalFlowActionState,
    FormData
  >(saveApprovalFlowAction, undefined)
  const wasPending = useRef(false)

  useEffect(() => {
    if (!wasPending.current || isPending) {
      wasPending.current = isPending
      return
    }
    wasPending.current = isPending
    if (state?.error) {
      toast.error(state.error)
      return
    }
    if (state?.success) {
      toast.success(`Alur "${leaveType.label}" berhasil disimpan.`)
      const id = setTimeout(() => setEditing(false), 0)
      return () => clearTimeout(id)
    }
  }, [isPending, state, leaveType.label])

  const Icon = leaveType.icon
  const hasConfiguredFlow = initialSteps.length > 0
  const displaySteps = editing ? steps : initialSteps
  const showAutoSkipNote = displaySteps.some((s) => AUTO_SKIP_TYPES.includes(s.approverType))

  function updateStep(index: number, patch: Partial<ApprovalStepValue>) {
    setSteps((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)))
  }

  function addStep() {
    setSteps((prev) => [
      ...prev,
      { approverType: "KEPALA_DEPARTEMEN", unlockAfter: false, approverEmployeeId: null },
    ])
  }

  function removeStep(index: number) {
    setSteps((prev) => prev.filter((_, i) => i !== index))
  }

  function moveStep(index: number, direction: -1 | 1) {
    setSteps((prev) => {
      const next = [...prev]
      const target = index + direction
      if (target < 0 || target >= next.length) return prev
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  function handleCancel() {
    setSteps(initialSteps)
    setEditing(false)
  }

  function handleStartEdit() {
    setSteps(initialSteps.length > 0 ? initialSteps : DEFAULT_STEPS)
    setEditing(true)
  }

  return (
    <Card>
      <CardHeader className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Icon className="size-4.5" />
          </span>
          <div>
            <CardTitle>{leaveType.label}</CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {displaySteps.length > 0
                ? `${leaveType.label} — ${displaySteps.map(stepDisplayLabel).join(" → ")}`
                : leaveType.description}
            </p>
          </div>
        </div>
        {!editing ? (
          <Button variant="outline" size="sm" onClick={handleStartEdit}>
            <Pencil className="size-3.5" />
            {hasConfiguredFlow ? "Edit" : "Atur Alur"}
          </Button>
        ) : null}
      </CardHeader>

      <CardContent className="border-t pt-4">
        {!editing ? (
          <>
            {hasConfiguredFlow ? (
              <div className="flex flex-wrap items-center gap-1.5">
                {initialSteps.map((step, index) => (
                  <div key={index} className="flex items-center gap-1.5">
                    {index > 0 ? (
                      <span className="text-muted-foreground">&rarr;</span>
                    ) : null}
                    <Badge variant="outline" className="gap-1">
                      {index + 1}. {stepDisplayLabel(step)}
                      {step.unlockAfter ? <Zap className="size-3 text-amber-500" /> : null}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">Belum ada step.</p>
            )}
            {showAutoSkipNote ? (
              <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800">
                <Info className="mr-1 inline size-3.5 align-text-bottom text-amber-500" />
                Step <span className="font-semibold">Atasan Langsung / Kepala Departemen</span>{" "}
                otomatis dilewati kalau pemohonnya sendiri menjabat posisi itu (tidak bisa
                approve pengajuan sendiri).
              </p>
            ) : null}
            {LEAVE_TYPE_NOTES[leaveType.value] ? (
              <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800">
                <Info className="mr-1 inline size-3.5 align-text-bottom text-amber-500" />
                {LEAVE_TYPE_NOTES[leaveType.value]}
              </p>
            ) : null}
          </>
        ) : (
          <form action={formAction} className="grid gap-3">
            <input type="hidden" name="leaveType" value={leaveType.value} />
            <input type="hidden" name="steps" value={JSON.stringify(steps)} />

            {steps.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">Belum ada step.</p>
            ) : (
              steps.map((step, index) => (
                <div
                  key={index}
                  className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/30 p-2"
                >
                  <span className="w-14 shrink-0 text-sm text-muted-foreground">
                    Step {index + 1}
                  </span>
                  <Select
                    value={step.approverType}
                    onValueChange={(value) =>
                      updateStep(index, {
                        approverType: value as ApprovalStepValue["approverType"],
                        approverEmployeeId: TYPES_REQUIRING_EMPLOYEE.includes(
                          value as ApprovalStepValue["approverType"]
                        )
                          ? step.approverEmployeeId
                          : null,
                      })
                    }
                    items={APPROVER_TYPE_OPTIONS}
                  >
                    <SelectTrigger className="w-56">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {APPROVER_TYPE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {TYPES_REQUIRING_EMPLOYEE.includes(step.approverType) ? (
                    (() => {
                      // Step Direksi cuma boleh diisi pegawai berjabatan Direktur/Direktur
                      // Utama. Step Pegawai Tertentu sebaliknya — semua pegawai KECUALI
                      // Direksi (Direksi sudah punya slot approver-nya sendiri).
                      const eligibleEmployees =
                        step.approverType === "DIREKSI"
                          ? employees.filter((e) => e.isDireksi)
                          : employees.filter((e) => !e.isDireksi)
                      return (
                        <Select
                          value={step.approverEmployeeId ? String(step.approverEmployeeId) : ""}
                          onValueChange={(value) =>
                            updateStep(index, { approverEmployeeId: Number(value) })
                          }
                          items={eligibleEmployees.map((e) => ({
                            value: String(e.id),
                            label: e.fullName,
                          }))}
                        >
                          <SelectTrigger className="w-48">
                            <SelectValue placeholder="Pilih pegawai" />
                          </SelectTrigger>
                          <SelectContent>
                            {eligibleEmployees.map((e) => (
                              <SelectItem key={e.id} value={String(e.id)}>
                                {e.fullName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )
                    })()
                  ) : null}

                  <label className="flex items-center gap-1.5 text-sm">
                    <input
                      type="checkbox"
                      checked={step.unlockAfter}
                      onChange={(e) => updateStep(index, { unlockAfter: e.target.checked })}
                    />
                    Unlock aksi setelah step ini
                  </label>
                  <div className="ml-auto flex gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      disabled={index === 0}
                      onClick={() => moveStep(index, -1)}
                    >
                      <ArrowUp className="size-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      disabled={index === steps.length - 1}
                      onClick={() => moveStep(index, 1)}
                    >
                      <ArrowDown className="size-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => removeStep(index)}
                    >
                      <Trash2 className="size-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))
            )}

            <p className="rounded-md border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800">
              <Info className="mr-1 inline size-3.5 align-text-bottom text-amber-500" />
              Step <span className="font-semibold">Atasan Langsung / Kepala Departemen</span>{" "}
              otomatis dilewati kalau pemohonnya sendiri menjabat posisi itu (tidak bisa approve
              pengajuan sendiri).
            </p>
            {LEAVE_TYPE_NOTES[leaveType.value] ? (
              <p className="rounded-md border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800">
                <Info className="mr-1 inline size-3.5 align-text-bottom text-amber-500" />
                {LEAVE_TYPE_NOTES[leaveType.value]}
              </p>
            ) : null}

            <div className="border-t pt-3">
              <Button type="button" variant="outline" size="sm" onClick={addStep}>
                <Plus className="size-3.5" />
                Tambah Step
              </Button>
              <p className="mt-1.5 text-xs text-destructive">Minimal 1 step approval</p>
            </div>

            {state?.error ? <p className="text-destructive text-sm">{state.error}</p> : null}

            <div className="flex gap-2">
              <Button type="submit" disabled={isPending || steps.length === 0}>
                {isPending ? "Menyimpan..." : "Simpan"}
              </Button>
              <Button type="button" variant="outline" onClick={handleCancel}>
                Batal
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  )
}
