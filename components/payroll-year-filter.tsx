"use client"

import { useRouter } from "next/navigation"

export function PayrollYearFilter({
  years,
  selectedYear,
}: {
  years: number[]
  selectedYear: number
}) {
  const router = useRouter()

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="tahun" className="text-sm text-muted-foreground">
        Tahun
      </label>
      <select
        id="tahun"
        value={selectedYear}
        onChange={(e) => router.push(`/admin/payroll/slip-gaji?tahun=${e.target.value}`)}
        className="h-9 rounded-lg border border-input bg-transparent px-3 text-sm dark:bg-input/30"
      >
        {years.map((year) => (
          <option key={year} value={year}>
            {year}
          </option>
        ))}
      </select>
    </div>
  )
}
