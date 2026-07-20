"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { FileSpreadsheet } from "lucide-react"

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

export function IzinMonitoringFilters({
  initialKind,
  initialFrom,
  initialTo,
}: {
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
    router.push(`/admin/izin/monitoring?${params.toString()}`)
  }

  const exportParams = new URLSearchParams({ dari: from, sampai: to })
  if (kind !== ALL_KINDS) exportParams.set("jenis", kind)

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
        nativeButton={false}
        render={<a href={`/api/laporan/monitoring-izin?${exportParams.toString()}`} download />}
      >
        <FileSpreadsheet className="size-3.5 text-emerald-600" />
        Ekspor Excel
      </Button>
    </div>
  )
}
