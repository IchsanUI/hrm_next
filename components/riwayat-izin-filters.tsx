"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

import { IZIN_MONITORING_KIND_OPTIONS } from "@/lib/izin-monitoring-constants"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const ALL_KINDS = "all"

function todayDateValue() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
}

// Sama pola filternya kayak Monitoring Izin (jenis + rentang tanggal), tapi
// tanpa tombol Ekspor Excel — Riwayat Izin cuma buat lihat riwayat sendiri,
// bukan laporan. Ditambah tombol "Hari Ini" kayak filter Log Aktivitas.
export function RiwayatIzinFilters({
  basePath,
  initialKind,
  initialFrom,
  initialTo,
}: {
  basePath: "/admin" | "/pegawai"
  initialKind: string
  initialFrom: string
  initialTo: string
}) {
  const router = useRouter()
  const [kind, setKind] = useState(initialKind || ALL_KINDS)
  const [from, setFrom] = useState(initialFrom)
  const [to, setTo] = useState(initialTo)

  function applyFilter(nextKind: string, nextFrom: string, nextTo: string) {
    const params = new URLSearchParams({ dari: nextFrom, sampai: nextTo })
    if (nextKind !== ALL_KINDS) params.set("jenis", nextKind)
    router.push(`${basePath}/riwayat-izin?${params.toString()}`)
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        name="jenis"
        value={kind}
        onValueChange={(value) => {
          const next = value ?? ALL_KINDS
          setKind(next)
          applyFilter(next, from, to)
        }}
        items={[
          { value: ALL_KINDS, label: "Semua Jenis" },
          ...IZIN_MONITORING_KIND_OPTIONS,
        ]}
      >
        <SelectTrigger className="w-fit">
          <SelectValue placeholder="Semua Jenis" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_KINDS}>Semua Jenis</SelectItem>
          {IZIN_MONITORING_KIND_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Label className="shrink-0 text-sm text-muted-foreground">Dari</Label>
      <Input
        aria-label="Dari tanggal"
        type="date"
        value={from}
        max={to || undefined}
        onChange={(e) => {
          setFrom(e.target.value)
          applyFilter(kind, e.target.value, to)
        }}
        className="w-fit"
      />
      <Label className="shrink-0 text-sm text-muted-foreground">Sampai</Label>
      <Input
        aria-label="Sampai tanggal"
        type="date"
        value={to}
        min={from || undefined}
        onChange={(e) => {
          setTo(e.target.value)
          applyFilter(kind, from, e.target.value)
        }}
        className="w-fit"
      />

      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          const today = todayDateValue()
          setFrom(today)
          setTo(today)
          applyFilter(kind, today, today)
        }}
      >
        Hari Ini
      </Button>
    </div>
  )
}
