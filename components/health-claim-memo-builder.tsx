"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Send } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { formatRupiah } from "@/lib/health-claim-labels"
import { formatRupiahLetter, terbilang } from "@/lib/terbilang"
import { createHealthClaimMemoAction } from "@/server/actions/health-claim-memo"

export type BuilderRow = {
  claimPublicId: string
  claimNumber: string
  employeeId: number
  employeeName: string
  patientLabel: string
  claimTypeName: string
  treatmentDate: string
  amount: number
  balanceBefore: number
  defaultNote: string
}

export function HealthClaimMemoBuilder({
  rows,
  minEmployees,
  canForce,
  defaults,
  today,
  doneBasePath,
}: {
  rows: BuilderRow[]
  minEmployees: number
  canForce: boolean
  defaults: { toText: string; fromText: string; subject: string; opening: string; closing: string }
  today: string
  doneBasePath: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  // Semua klaim terkonfirmasi tercentang; petugas bisa melepas klaim yang
  // ingin ditunda ke Nota Dinas berikutnya. Beberapa klaim dari pegawai yang
  // sama boleh ikut dan masing-masing dihitung untuk syarat minimal.
  const allIds = () => new Set(rows.map((r) => r.claimPublicId))
  const [selected, setSelected] = useState(allIds)
  const [notes, setNotes] = useState<Record<string, string>>(() =>
    Object.fromEntries(rows.map((r) => [r.claimPublicId, r.defaultNote])),
  )
  const [memoDate, setMemoDate] = useState(today)
  const [texts, setTexts] = useState(defaults)
  const [forceReason, setForceReason] = useState("")

  const chosen = rows.filter((r) => selected.has(r.claimPublicId))
  const claimsPerEmployee = rows.reduce<Record<number, number>>((acc, r) => {
    acc[r.employeeId] = (acc[r.employeeId] ?? 0) + 1
    return acc
  }, {})
  // Saldo awal pratinjau: baris disusun dengan asumsi klaim sebelumnya milik
  // pegawai yang sama ikut diajukan; kembalikan nominal klaim yang tidak dipilih.
  const previewBalance = (row: BuilderRow, index: number) =>
    row.balanceBefore +
    rows
      .slice(0, index)
      .filter((r) => r.employeeId === row.employeeId && !selected.has(r.claimPublicId))
      .reduce((sum, r) => sum + r.amount, 0)
  const toggle = (row: BuilderRow, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (on) next.add(row.claimPublicId)
      else next.delete(row.claimPublicId)
      return next
    })
  const total = chosen.reduce((s, r) => s + r.amount, 0)
  const employeeCount = new Set(chosen.map((r) => r.employeeId)).size
  // Syarat minimal dihitung per klaim.
  const short = chosen.length < minEmployees
  const preview = texts.opening
    .replaceAll("{total}", formatRupiahLetter(total))
    .replaceAll("{terbilang}", terbilang(total))

  function submit() {
    startTransition(async () => {
      const result = await createHealthClaimMemoAction({
        claimPublicIds: chosen.map((r) => r.claimPublicId),
        memoDate,
        notes,
        ...texts,
        forceReason: short ? forceReason : undefined,
      })
      if ("error" in result) {
        toast.error(result.error)
        return
      }
      toast.success(result.success)
      router.push(`${doneBasePath}/${result.publicId}`)
    })
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
      <div className="grid content-start gap-6">
        <Card>
          <CardHeader className="border-b">
            <CardTitle>Klaim yang Diajukan</CardTitle>
            <CardDescription>
              Klaim terkonfirmasi yang belum masuk Nota Dinas. Hilangkan centang untuk menunda klaim ke Nota Dinas
              berikutnya. Beberapa klaim dari pegawai yang sama boleh ikut dan dihitung masing-masing. Keterangan bisa
              disunting dan akan tercetak di kolom Keterangan.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="w-10 min-w-10 px-3 py-2">
                      <Checkbox
                        aria-label="Pilih semua"
                        checked={chosen.length === rows.length}
                        onCheckedChange={(v) => setSelected(v === true ? allIds() : new Set())}
                      />
                    </th>
                    <th className="px-3 py-2 font-medium">Pegawai</th>
                    <th className="px-3 py-2 font-medium">Pasien</th>
                    <th className="px-3 py-2 text-right font-medium">Saldo Awal</th>
                    <th className="px-3 py-2 text-right font-medium">Jumlah Klaim</th>
                    <th className="px-3 py-2 font-medium">Keterangan</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, index) => {
                    const isChosen = selected.has(r.claimPublicId)
                    return (
                      <tr
                        key={r.claimPublicId}
                        className={`border-t align-top ${isChosen ? "" : "bg-muted/30 text-muted-foreground"}`}
                      >
                        <td className="w-10 min-w-10 px-3 py-2">
                          <Checkbox
                            aria-label={`Pilih ${r.claimNumber}`}
                            checked={isChosen}
                            onCheckedChange={(v) => toggle(r, v === true)}
                          />
                        </td>
                        <td className="px-3 py-2">
                          {r.employeeName}
                          <span className="block text-xs text-muted-foreground">
                            {r.claimNumber} · {r.claimTypeName} · {r.treatmentDate}
                          </span>
                          {!isChosen ? (
                            <span className="mt-1 inline-flex rounded-full border border-sky-300 bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-800 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300">
                              Masuk Nota Dinas berikutnya
                            </span>
                          ) : claimsPerEmployee[r.employeeId] > 1 ? (
                            <span className="mt-1 block text-[11px] text-muted-foreground">
                              Pegawai ini punya {claimsPerEmployee[r.employeeId]} klaim di antrean
                            </span>
                          ) : null}
                        </td>
                        <td className="px-3 py-2">{r.patientLabel}</td>
                        <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                          {formatRupiah(previewBalance(r, index))}
                        </td>
                        <td className="px-3 py-2 text-right font-medium tabular-nums whitespace-nowrap">
                          {formatRupiah(r.amount)}
                        </td>
                        <td className="px-3 py-1.5">
                          <Input
                            className="h-8 min-w-48"
                            aria-label={`Keterangan ${r.claimNumber}`}
                            value={notes[r.claimPublicId] ?? ""}
                            disabled={!isChosen}
                            onChange={(e) => setNotes((prev) => ({ ...prev, [r.claimPublicId]: e.target.value }))}
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Saldo awal dihitung ulang saat Nota Dinas dibuat, sesuai klaim yang benar-benar dipilih.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <CardTitle>Isi Surat</CardTitle>
            <CardDescription>
              Teks bawaan dari Pengaturan. Perubahan di sini hanya berlaku untuk Nota Dinas ini.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 pt-2">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="memoDate">Tanggal</Label>
                <Input id="memoDate" type="date" value={memoDate} onChange={(e) => setMemoDate(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="to">Kepada</Label>
                <Input
                  id="to"
                  value={texts.toText}
                  onChange={(e) => setTexts((t) => ({ ...t, toText: e.target.value }))}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="from">Dari</Label>
                <Input
                  id="from"
                  value={texts.fromText}
                  onChange={(e) => setTexts((t) => ({ ...t, fromText: e.target.value }))}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="subject">Perihal</Label>
                <Input
                  id="subject"
                  value={texts.subject}
                  onChange={(e) => setTexts((t) => ({ ...t, subject: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="opening">Teks pembuka</Label>
              <Textarea
                id="opening"
                rows={4}
                value={texts.opening}
                onChange={(e) => setTexts((t) => ({ ...t, opening: e.target.value }))}
              />
              <p className="rounded-md bg-muted/50 px-3 py-2 text-xs leading-relaxed">{preview}</p>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="closing">Teks penutup</Label>
              <Textarea
                id="closing"
                rows={3}
                value={texts.closing}
                onChange={(e) => setTexts((t) => ({ ...t, closing: e.target.value }))}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="content-start xl:sticky xl:top-4 xl:self-start">
        <CardContent className="grid gap-3 text-sm">
          <p className="font-medium">Ringkasan</p>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Klaim dipilih</span>
            <span className={short ? "font-medium text-amber-700 tabular-nums dark:text-amber-400" : "tabular-nums"}>
              {chosen.length} / minimal {minEmployees}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Pegawai</span>
            <span className="tabular-nums">{employeeCount}</span>
          </div>
          <div className="flex justify-between border-t pt-2 text-base font-semibold">
            <span>Total</span>
            <span className="tabular-nums">{formatRupiah(total)}</span>
          </div>
          <p className="text-xs text-muted-foreground">{terbilang(total)}</p>

          {short ? (
            canForce ? (
              <div className="grid gap-1.5">
                <Label htmlFor="force" className="text-amber-700 dark:text-amber-400">
                  Klaim kurang dari minimal. Alasan membuat sekarang:
                </Label>
                <Textarea id="force" rows={2} value={forceReason} onChange={(e) => setForceReason(e.target.value)} />
              </div>
            ) : (
              <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                Nota Dinas membutuhkan minimal {minEmployees} klaim. Hanya Super Admin yang bisa membuat dengan jumlah
                kurang.
              </p>
            )
          ) : null}

          <Button
            onClick={submit}
            disabled={isPending || chosen.length === 0 || (short && (!canForce || forceReason.trim().length < 5))}
          >
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            Buat & Ajukan Nota Dinas
          </Button>
          <p className="text-xs text-muted-foreground">
            Setelah dibuat, Nota Dinas dikirim ke penyetuju pertama sesuai Alur Persetujuan di Pengaturan.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
