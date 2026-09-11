"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import type { PayrollApprovalStage } from "@prisma/client"

import { savePayrollApprovalFlowAction } from "@/server/actions/payroll-approval"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

export type PayrollApproverOption = { id: number; label: string }

function StageEditor({
  stage,
  title,
  description,
  employees,
  initialApproverIds,
}: {
  stage: PayrollApprovalStage
  title: string
  description: string
  employees: PayrollApproverOption[]
  initialApproverIds: number[]
}) {
  const [approverIds, setApproverIds] = useState<number[]>(initialApproverIds)
  const [isPending, startTransition] = useTransition()

  function updateAt(index: number, value: string) {
    const next = approverIds.slice()
    next[index] = Number(value)
    setApproverIds(next)
  }

  function handleSave() {
    startTransition(async () => {
      const result = await savePayrollApprovalFlowAction(stage, approverIds)
      if (result?.error) toast.error(result.error)
      else toast.success("Alur approval payroll disimpan.")
    })
  }

  return (
    <div className="grid gap-3 rounded-lg border p-4">
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>

      {approverIds.length === 0 ? (
        <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
          Belum ada penyetuju. Selama kosong, keputusan tetap di tangan Super Admin seperti
          sebelumnya — tidak ada persetujuan berjenjang untuk tahap ini.
        </p>
      ) : null}

      {approverIds.map((id, index) => (
        <div key={index} className="flex items-center gap-2">
          <span className="w-16 shrink-0 text-xs text-muted-foreground">Tahap {index + 1}</span>
          <select
            value={id || ""}
            onChange={(e) => updateAt(index, e.target.value)}
            className="h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm dark:bg-input/30"
          >
            <option value="">Pilih pegawai…</option>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.label}
              </option>
            ))}
          </select>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setApproverIds(approverIds.filter((_, i) => i !== index))}
          >
            Hapus
          </Button>
        </div>
      ))}

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => setApproverIds([...approverIds, 0])}>
          Tambah Tahap
        </Button>
        <Button type="button" size="sm" disabled={isPending} onClick={handleSave}>
          {isPending ? "Menyimpan..." : "Simpan"}
        </Button>
      </div>
    </div>
  )
}

export function PayrollApprovalFlowSettings({
  employees,
  lockApproverIds,
  unlockApproverIds,
}: {
  employees: PayrollApproverOption[]
  lockApproverIds: number[]
  unlockApproverIds: number[]
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Alur Approval Payroll</CardTitle>
        <CardDescription>
          Tentukan siapa yang wajib memeriksa & memutuskan payroll, terpisah dari alur approval
          izin. Penyetuju cukup pegawai biasa — mereka meninjau rincian lewat halaman khusus
          read-only tanpa bisa mengubah angkanya, jadi yang menyusun dan yang menyetujui tetap
          orang yang berbeda.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <StageEditor
          stage="LOCK"
          title="Tahap 1 — Persetujuan Penguncian"
          description="Dijalankan saat HR mengajukan payroll. Setelah seluruh tahap disetujui, periode terkunci dan slip gaji terbit ke pegawai."
          employees={employees}
          initialApproverIds={lockApproverIds}
        />
        <StageEditor
          stage="UNLOCK"
          title="Tahap 2 — Persetujuan Koreksi"
          description="Dijalankan saat HR minta membuka periode yang sudah terkunci. Boleh diisi pejabat yang lebih tinggi daripada tahap penguncian, karena yang diubah adalah data yang sudah final & sudah dilihat pegawai."
          employees={employees}
          initialApproverIds={unlockApproverIds}
        />
        <p className="text-xs text-muted-foreground">
          Super Admin tetap bisa memaksa kunci/buka tanpa menunggu penyetuju kalau mereka
          berhalangan lama — tapi alasannya wajib diisi, tercatat di log, dan periodenya ditandai
          sebagai override darurat.
        </p>
      </CardContent>
    </Card>
  )
}
