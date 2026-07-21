"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

function todayDateValue() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
}

export function AttendanceDateFilter({
  initialFrom,
  initialTo,
  basePath = "/admin/absensi/data",
}: {
  initialFrom: string
  initialTo: string
  basePath?: string
}) {
  const router = useRouter()
  const [from, setFrom] = useState(initialFrom)
  const [to, setTo] = useState(initialTo)

  function applyFilter(nextFrom: string, nextTo: string) {
    router.push(`${basePath}?dari=${nextFrom}&sampai=${nextTo}`)
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Label className="shrink-0">Tanggal</Label>
      <span className="text-sm text-muted-foreground">Dari</span>
      <Input
        aria-label="Dari tanggal"
        type="date"
        value={from}
        max={to || undefined}
        onChange={(e) => {
          setFrom(e.target.value)
          applyFilter(e.target.value, to)
        }}
        className="w-fit"
      />
      <span className="text-sm text-muted-foreground">Sampai</span>
      <Input
        aria-label="Sampai tanggal"
        type="date"
        value={to}
        min={from || undefined}
        onChange={(e) => {
          setTo(e.target.value)
          applyFilter(from, e.target.value)
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
          applyFilter(today, today)
        }}
      >
        Hari Ini
      </Button>
    </div>
  )
}
