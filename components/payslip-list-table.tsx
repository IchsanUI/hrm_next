"use client"

import { useState, useTransition, type FormEvent } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { toast } from "sonner"

import { upsertPayrollManualEntriesAction } from "@/server/actions/payroll-manual-entry"
import { RupiahInput } from "@/components/rupiah-input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { DataTable } from "@/components/data-table"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export type PayslipItemRow = {
  name: string
  detail: string | null
  category: string
  amount: number
}

export type ManualComponent = { id: number; name: string }

export type PayslipRow = {
  id: number
  employeeId: number
  employeeName: string
  employeeNumber: string
  golongan: string | null
  salaryScaleVersionName: string | null
  gajiPokok: number
  grossPay: number
  totalDeduction: number
  pph21: number
  netPay: number
  items: PayslipItemRow[]
  manualEntries: Record<number, number>
  leaveSummary: { cuti: number; sakit: number; dispensasiSppd: number }
}

function formatRupiah(value: number) {
  return `Rp${Math.round(value).toLocaleString("id-ID")}`
}

function sumBy(items: PayslipItemRow[], category: string) {
  return items.filter((item) => item.category === category).reduce((sum, item) => sum + item.amount, 0)
}

function ItemRow({ item }: { item: PayslipItemRow }) {
  return (
    <div className="py-1 text-sm">
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-muted-foreground">{item.name}</span>
        <span className="whitespace-nowrap font-medium">{formatRupiah(item.amount)}</span>
      </div>
      {item.detail ? (
        <div className="mt-0.5 grid gap-0.5 whitespace-pre-line text-xs text-muted-foreground/80">
          {item.detail}
        </div>
      ) : null}
    </div>
  )
}

function SectionTotal({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-t pt-2 mt-1 text-sm font-semibold">
      <span>{label}</span>
      <span className="whitespace-nowrap">{formatRupiah(value)}</span>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-muted/20 p-4">
      <p className="mb-2 text-sm font-semibold">{title}</p>
      {children}
    </div>
  )
}

function RincianDialog({ payslip, onOpenChange }: { payslip: PayslipRow | null; onOpenChange: (open: boolean) => void }) {
  const items = payslip?.items ?? []
  const pendapatanTetap = items.filter((item) => item.category === "PENDAPATAN_TETAP")
  const pendapatanTidakTetap = items.filter((item) => item.category === "PENDAPATAN_TIDAK_TETAP")
  const potongan = items.filter((item) => item.category === "POTONGAN")
  const pinjaman = items.filter((item) => item.category === "PINJAMAN")

  const bruto = sumBy(items, "PENDAPATAN_TETAP")
  const totalPotongan = sumBy(items, "POTONGAN")
  const totalPinjaman = sumBy(items, "PINJAMAN")
  const netto = bruto - totalPotongan

  return (
    <Dialog open={payslip !== null} onOpenChange={(open) => !open && onOpenChange(false)}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            Rincian Slip Gaji — {payslip?.employeeName} ({payslip?.employeeNumber})
          </DialogTitle>
        </DialogHeader>

        {payslip ? (
          <p className="-mt-2 text-xs text-muted-foreground">
            Golongan: <span className="font-medium">{payslip.golongan ?? "Belum diatur"}</span>
            {" · "}
            Skala Gaji Pokok:{" "}
            <span className="font-medium">{payslip.salaryScaleVersionName ?? "Belum ada versi aktif"}</span>
          </p>
        ) : null}

        <div className="grid gap-4 py-2 sm:grid-cols-2">
          <div className="grid gap-4">
            <Section title="Penerimaan">
              <div className="grid gap-0.5 divide-y">
                {pendapatanTetap.map((item, index) => (
                  <ItemRow key={index} item={item} />
                ))}
              </div>
              <SectionTotal label="Bruto" value={bruto} />
            </Section>

            <Section title="Penerimaan Lain">
              {pendapatanTidakTetap.length > 0 ? (
                <div className="grid gap-0.5 divide-y">
                  {pendapatanTidakTetap.map((item, index) => (
                    <ItemRow key={index} item={item} />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Tidak ada.</p>
              )}
            </Section>
          </div>

          <div className="grid gap-4">
            <Section title="Potongan">
              <div className="grid gap-0.5 divide-y">
                {potongan.map((item, index) => (
                  <ItemRow key={index} item={item} />
                ))}
              </div>
              <SectionTotal label="Total Potongan" value={totalPotongan} />
              <SectionTotal label="Netto" value={netto} />
            </Section>

            <Section title="Pinjaman">
              {pinjaman.length > 0 ? (
                <div className="grid gap-0.5 divide-y">
                  {pinjaman.map((item, index) => (
                    <ItemRow key={index} item={item} />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Tidak ada.</p>
              )}
              <SectionTotal label="Total Pinjaman" value={totalPinjaman} />
            </Section>
          </div>
        </div>

        {payslip ? (
          <Section title="Keterangan (Dalam Hari)">
            <p className="mb-2 text-xs text-muted-foreground">
              Rekap izin approved di periode ini. Sakit (Ket. Dokter) &amp;
              Dispensasi/SPPD SUDAH ditambahkan ke hitungan Tunjangan
              Kehadiran di atas (tetap ditanggung perusahaan, tidak
              memotong tunjangan) — Cuti biasa TIDAK ditambahkan.
            </p>
            <div className="grid gap-0.5 divide-y sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              <div className="flex items-baseline justify-between gap-2 py-1 pr-4 text-sm sm:justify-start">
                <span className="text-muted-foreground">Cuti</span>
                <span className="font-medium">{payslip.leaveSummary?.cuti ?? 0}</span>
              </div>
              <div className="flex items-baseline justify-between gap-2 py-1 pr-4 pl-0 text-sm sm:justify-start sm:pl-4">
                <span className="text-muted-foreground">Sakit (Ket. Dokter)</span>
                <span className="font-medium">{payslip.leaveSummary?.sakit ?? 0}</span>
              </div>
              <div className="flex items-baseline justify-between gap-2 py-1 pl-0 text-sm sm:justify-start sm:pl-4">
                <span className="text-muted-foreground">Dispensasi/SPPD</span>
                <span className="font-medium">{payslip.leaveSummary?.dispensasiSppd ?? 0}</span>
              </div>
            </div>
          </Section>
        ) : null}

        <div className="flex items-baseline justify-between rounded-lg border bg-muted/40 px-4 py-3">
          <span className="text-base font-semibold">Gaji Bersih (Take Home Pay)</span>
          <span className="text-base font-semibold">{payslip ? formatRupiah(payslip.netPay) : "-"}</span>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function ManualEntryDialog({
  payslip,
  periodId,
  manualComponents,
  isLocked,
  onOpenChange,
}: {
  payslip: PayslipRow | null
  periodId: number
  manualComponents: ManualComponent[]
  isLocked: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!payslip) return
    const formData = new FormData(event.currentTarget)
    startTransition(async () => {
      const result = await upsertPayrollManualEntriesAction(periodId, payslip.employeeId, undefined, formData)
      if (result?.error) {
        setError(result.error)
        toast.error(result.error)
      } else {
        setError(null)
        onOpenChange(false)
        toast.success(
          "Komponen manual berhasil disimpan. Klik Generate/Refresh Payslip supaya nilainya ikut terhitung."
        )
      }
    })
  }

  return (
    <Dialog open={payslip !== null} onOpenChange={(open) => !open && onOpenChange(false)}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            Isi Komponen Manual — {payslip?.employeeName} ({payslip?.employeeNumber})
          </DialogTitle>
        </DialogHeader>
        <form key={payslip?.id ?? "none"} onSubmit={handleSubmit} className="grid gap-4">
          <p className="text-sm text-muted-foreground">
            Kosongkan/isi 0 kalau komponen ini tidak berlaku periode ini —
            baris itu tidak akan muncul di payslip.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {manualComponents.map((component) => (
              <div key={component.id} className="grid gap-2">
                <Label htmlFor={`component-${component.id}`}>{component.name}</Label>
                <RupiahInput
                  id={`component-${component.id}`}
                  name={`component_${component.id}`}
                  disabled={isLocked}
                  defaultValue={payslip?.manualEntries[component.id]}
                />
              </div>
            ))}
          </div>
          {error ? <p className="text-destructive text-sm">{error}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={isPending || isLocked}>
              {isPending ? "Menyimpan..." : "Simpan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function PayslipListTable({
  payslips,
  periodId,
  manualComponents,
  isLocked,
}: {
  payslips: PayslipRow[]
  periodId: number
  manualComponents: ManualComponent[]
  isLocked: boolean
}) {
  const [selected, setSelected] = useState<PayslipRow | null>(null)
  const [manualTarget, setManualTarget] = useState<PayslipRow | null>(null)

  const columns: ColumnDef<PayslipRow, unknown>[] = [
    { accessorKey: "employeeNumber", header: "NIP" },
    { accessorKey: "employeeName", header: "Nama Pegawai" },
    {
      id: "gajiPokok",
      header: "Gaji Pokok",
      accessorFn: (row) => formatRupiah(row.gajiPokok),
    },
    {
      id: "grossPay",
      header: "Total Penerimaan",
      accessorFn: (row) => formatRupiah(row.grossPay),
    },
    {
      id: "totalDeduction",
      header: "Total Potongan",
      accessorFn: (row) => formatRupiah(row.totalDeduction),
    },
    {
      id: "netPay",
      header: "Gaji Bersih",
      accessorFn: (row) => formatRupiah(row.netPay),
    },
    {
      id: "actions",
      header: "Aksi",
      cell: ({ row }) => (
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setSelected(row.original)}>
            Rincian
          </Button>
          {manualComponents.length > 0 ? (
            <Button size="sm" variant="outline" onClick={() => setManualTarget(row.original)}>
              Isi Manual
            </Button>
          ) : null}
        </div>
      ),
    },
  ]

  return (
    <div>
      <DataTable
        columns={columns}
        data={payslips}
        searchPlaceholder="Cari pegawai..."
        emptyMessage="Belum ada payslip — klik Generate/Refresh Payslip."
        pageSize={20}
      />
      <RincianDialog payslip={selected} onOpenChange={(open) => !open && setSelected(null)} />
      <ManualEntryDialog
        payslip={manualTarget}
        periodId={periodId}
        manualComponents={manualComponents}
        isLocked={isLocked}
        onOpenChange={(open) => !open && setManualTarget(null)}
      />
    </div>
  )
}
