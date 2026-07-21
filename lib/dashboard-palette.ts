// Urutan kategorikal tetap (CVD-safe) — nilai aslinya didefinisikan di
// app/globals.css (--chart-1..8, light & dark). JANGAN diacak/di-cycle
// sendiri di komponen; ambil dari sini biar urutannya konsisten di semua
// chart dashboard.
export const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
  "var(--chart-7)",
  "var(--chart-8)",
]

export function chartColor(index: number) {
  return CHART_COLORS[index % CHART_COLORS.length]
}
