import { Building2, GraduationCap, UserCheck, Users } from "lucide-react"

import { categorizeEducation, type EducationBucket } from "@/lib/reports/employee-report"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

// Statistik ringkas di atas tabel Data Pegawai. Dihitung dari pegawai AKTIF
// (yang tidak dihapus). Dua seri jenis kelamin memakai dua warna pertama
// palet kategorikal proyek secara berurutan (--chart-1 biru = Laki-laki,
// --chart-2 hijau = Perempuan; pasangan ini lolos validasi CVD terang/gelap),
// selalu disertai legenda & angka sehingga tidak bergantung pada warna saja.

export type EmployeeStatInput = {
  gender: "MALE" | "FEMALE"
  isActive: boolean
  lastEducation: string | null
  department: { name: string }
  employmentStatus: { name: string }
}

// Urutan baris mengikuti format rekap perusahaan. "Belum diisi" dipisah dari
// "Lainnya" supaya kelihatan berapa data pendidikan yang masih kosong.
const EDUCATION_ROWS: { key: EducationBucket | "KOSONG"; label: string; alwaysShow: boolean }[] = [
  { key: "S1", label: "S1", alwaysShow: true },
  { key: "S2", label: "S2", alwaysShow: true },
  { key: "S3", label: "S3", alwaysShow: true },
  { key: "D3", label: "D3", alwaysShow: true },
  { key: "SMA/K", label: "SMA/SMK", alwaysShow: true },
  { key: "SMP", label: "SMP", alwaysShow: true },
  { key: "LAINNYA", label: "Lainnya", alwaysShow: false },
  { key: "KOSONG", label: "Belum diisi", alwaysShow: false },
]

const MALE = "var(--chart-1)"
const FEMALE = "var(--chart-2)"

function pct(part: number, total: number) {
  return total > 0 ? Math.round((part / total) * 100) : 0
}

function countBy<T>(items: T[], key: (item: T) => string) {
  const map = new Map<string, number>()
  for (const item of items) map.set(key(item), (map.get(key(item)) ?? 0) + 1)
  return [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
}

function Legend() {
  return (
    <div className="flex items-center gap-3 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-1.5">
        <span className="size-2.5 rounded-sm" style={{ backgroundColor: MALE }} />
        Laki-laki
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="size-2.5 rounded-sm" style={{ backgroundColor: FEMALE }} />
        Perempuan
      </span>
    </div>
  )
}

// Bar bertumpuk L/P — lebar total relatif terhadap baris terbesar, celah
// 2px antar-segmen.
function GenderBar({ male, female, max }: { male: number; female: number; max: number }) {
  const total = male + female
  return (
    <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
      <div className="flex h-full gap-[2px]" style={{ width: `${(total / Math.max(1, max)) * 100}%` }}>
        {male > 0 ? (
          <div className="h-full rounded-l-full" style={{ flexGrow: male, backgroundColor: MALE }} title={`Laki-laki: ${male}`} />
        ) : null}
        {female > 0 ? (
          <div
            className={male > 0 ? "h-full rounded-r-full" : "h-full rounded-full"}
            style={{ flexGrow: female, backgroundColor: FEMALE }}
            title={`Perempuan: ${female}`}
          />
        ) : null}
      </div>
    </div>
  )
}

export function EmployeeStats({ employees }: { employees: EmployeeStatInput[] }) {
  const active = employees.filter((e) => e.isActive)
  const inactiveCount = employees.length - active.length
  const male = active.filter((e) => e.gender === "MALE").length
  const female = active.length - male

  const departments = new Map<string, { male: number; female: number }>()
  for (const e of active) {
    const d = departments.get(e.department.name) ?? { male: 0, female: 0 }
    if (e.gender === "MALE") d.male++
    else d.female++
    departments.set(e.department.name, d)
  }
  const departmentRows = [...departments.entries()]
    .map(([name, v]) => ({ name, ...v, total: v.male + v.female }))
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name))
  const maxDepartment = Math.max(1, ...departmentRows.map((d) => d.total))

  const statuses = countBy(active, (e) => e.employmentStatus.name)

  // Pendidikan × status kepegawaian — kolom status mengikuti status yang
  // benar-benar dipakai (urutan dari jumlah terbanyak), sama dengan ringkasan.
  const statusNames = statuses.map(([name]) => name)
  const educationCounts = new Map<string, Map<string, number>>()
  for (const e of active) {
    const key = e.lastEducation?.trim() ? categorizeEducation(e.lastEducation) : "KOSONG"
    const row = educationCounts.get(key) ?? new Map<string, number>()
    row.set(e.employmentStatus.name, (row.get(e.employmentStatus.name) ?? 0) + 1)
    educationCounts.set(key, row)
  }
  const educationRows = EDUCATION_ROWS.map((r) => {
    const counts = educationCounts.get(r.key) ?? new Map<string, number>()
    const total = [...counts.values()].reduce((s, n) => s + n, 0)
    return { ...r, counts, total }
  }).filter((r) => r.alwaysShow || r.total > 0)

  return (
    <div className="mb-6 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,1.2fr)]">
      {/* Ringkasan */}
      <Card className="gap-0 py-0">
        <CardHeader className="border-b px-4 py-3 [.border-b]:pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Users className="size-4 text-muted-foreground" />
            Ringkasan
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 p-4">
          <div>
            <p className="text-xs text-muted-foreground">Pegawai aktif</p>
            <p className="text-3xl leading-tight font-semibold tabular-nums">{active.length}</p>
            {inactiveCount > 0 ? (
              <p className="text-xs text-muted-foreground">+{inactiveCount} nonaktif</p>
            ) : null}
          </div>

          <div className="grid gap-2">
            <div className="flex items-baseline justify-between text-sm">
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm" style={{ backgroundColor: MALE }} />
                Laki-laki
              </span>
              <span className="tabular-nums">
                <span className="font-semibold">{male}</span>{" "}
                <span className="text-xs text-muted-foreground">({pct(male, active.length)}%)</span>
              </span>
            </div>
            <div className="flex items-baseline justify-between text-sm">
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm" style={{ backgroundColor: FEMALE }} />
                Perempuan
              </span>
              <span className="tabular-nums">
                <span className="font-semibold">{female}</span>{" "}
                <span className="text-xs text-muted-foreground">({pct(female, active.length)}%)</span>
              </span>
            </div>
            <GenderBar male={male} female={female} max={male + female} />
          </div>

          <div className="border-t pt-3">
            <p className="mb-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              <UserCheck className="size-3.5" />
              Status kepegawaian
            </p>
            <ul className="grid gap-1 text-sm">
              {statuses.map(([name, n]) => (
                <li key={name} className="flex justify-between gap-2">
                  <span className="truncate">{name}</span>
                  <span className="font-semibold tabular-nums">{n}</span>
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Per bagian */}
      <Card className="gap-0 py-0">
        <CardHeader className="border-b px-4 py-3 [.border-b]:pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Building2 className="size-4 text-muted-foreground" />
              Per Bagian
            </CardTitle>
            <Legend />
          </div>
        </CardHeader>
        <CardContent className="p-4">
          {departmentRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada data.</p>
          ) : (
            <ul className="grid max-h-72 gap-3 overflow-y-auto pr-1">
              {departmentRows.map((d) => (
                <li key={d.name} title={`${d.name}: ${d.total} pegawai (L ${d.male}, P ${d.female})`}>
                  <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                    <span className="truncate">{d.name}</span>
                    <span className="shrink-0 tabular-nums">
                      <span className="font-semibold">{d.total}</span>
                      <span className="ml-1.5 text-xs text-muted-foreground">
                        L {d.male} · P {d.female}
                      </span>
                    </span>
                  </div>
                  <GenderBar male={d.male} female={d.female} max={maxDepartment} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Pendidikan × status kepegawaian */}
      <Card className="gap-0 py-0">
        <CardHeader className="border-b px-4 py-3 [.border-b]:pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <GraduationCap className="size-4 text-muted-foreground" />
            Berdasarkan Pendidikan
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Pendidikan</th>
                {statusNames.map((s) => (
                  <th key={s} className="px-2 py-2 text-right font-medium whitespace-nowrap">
                    {s}
                  </th>
                ))}
                <th className="px-4 py-2 text-right font-medium">Jumlah</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {educationRows.map((r) => (
                <tr key={r.key} className={r.key === "KOSONG" ? "text-muted-foreground" : undefined}>
                  <td className="px-4 py-1.5">{r.label}</td>
                  {statusNames.map((s) => {
                    const n = r.counts.get(s) ?? 0
                    return (
                      <td key={s} className={`px-2 py-1.5 text-right tabular-nums ${n === 0 ? "text-muted-foreground/50" : ""}`}>
                        {n}
                      </td>
                    )
                  })}
                  <td className="px-4 py-1.5 text-right font-semibold tabular-nums">{r.total}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 font-semibold">
              <tr>
                <td className="px-4 py-2">Total</td>
                {statuses.map(([s, n]) => (
                  <td key={s} className="px-2 py-2 text-right tabular-nums">
                    {n}
                  </td>
                ))}
                <td className="px-4 py-2 text-right tabular-nums">{active.length}</td>
              </tr>
            </tfoot>
          </table>
          {educationRows.some((r) => r.key === "KOSONG") ? (
            <p className="border-t px-4 py-2 text-xs text-muted-foreground">
              Lengkapi pendidikan terakhir lewat Edit Pegawai.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
