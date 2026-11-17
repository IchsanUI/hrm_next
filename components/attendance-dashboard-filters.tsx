"use client"

import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { Loader2 } from "lucide-react"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export function AttendanceDashboardFilters({
  month,
  department,
  months,
  departments,
}: {
  month: string
  department: string
  months: { value: string; label: string }[]
  departments: { value: string; label: string }[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const deptItems = [{ value: "", label: "Semua bagian" }, ...departments]

  const go = (next: { bulan?: string; bagian?: string }) => {
    const params = new URLSearchParams()
    const b = next.bulan ?? month
    const g = next.bagian ?? department
    if (b) params.set("bulan", b)
    if (g) params.set("bagian", g)
    startTransition(() => router.push(`?${params.toString()}`))
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {isPending ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : null}
      <Select value={month} onValueChange={(v) => go({ bulan: String(v ?? month) })} items={months}>
        <SelectTrigger className="w-44" aria-label="Pilih bulan">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {months.map((m) => (
            <SelectItem key={m.value} value={m.value}>
              {m.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={department} onValueChange={(v) => go({ bagian: String(v ?? "") })} items={deptItems}>
        <SelectTrigger className="w-52" aria-label="Pilih bagian">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {deptItems.map((d) => (
            <SelectItem key={d.value || "all"} value={d.value}>
              {d.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
