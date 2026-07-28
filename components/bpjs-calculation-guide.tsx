import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

function Step({ children, className }: { children: React.ReactNode; className?: string }) {
  return <li className={className ? `leading-relaxed ${className}` : "leading-relaxed"}>{children}</li>
}

function formatRupiah(value: number) {
  return `Rp${value.toLocaleString("id-ID")}`
}

// Contoh pakai Gaji Bruto Rp5.747.015 — angka yang sama dengan contoh di
// Panduan Metode PPh 21 (biar gampang dibandingkan) — dan rate DEFAULT
// sistem (lihat BpjsSettings.@default di schema): Kesehatan 1%/4%, JHT
// 2%/3,7%, JP 1%/2%, JKK 0,24%, JKM 0,3%. Rate aktual bisa beda kalau admin
// sudah mengubahnya di form "Rate Iuran BPJS" di bawah.
const GAJI_CONTOH = 5747015

export function BpjsCalculationGuide() {
  const kesehatanEmployee = GAJI_CONTOH * 0.01
  const kesehatanCompany = GAJI_CONTOH * 0.04
  const jhtEmployee = GAJI_CONTOH * 0.02
  const jhtCompany = GAJI_CONTOH * 0.037
  const jpEmployee = GAJI_CONTOH * 0.01
  const jpCompany = GAJI_CONTOH * 0.02
  const jkk = GAJI_CONTOH * 0.0024
  const jkm = GAJI_CONTOH * 0.003
  const totalEmployee = kesehatanEmployee + jhtEmployee + jpEmployee
  const totalCompany = kesehatanCompany + jhtCompany + jpCompany + jkk + jkm

  return (
    <Card className="border-violet-300 bg-violet-100 dark:border-violet-800 dark:bg-violet-950">
      <CardHeader>
        <CardTitle>Panduan Perhitungan BPJS</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 text-sm">
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-400">
          <strong>Catatan:</strong> rate di bawah ini baru sebatas{" "}
          <strong>data pengaturan</strong> — potongan BPJS{" "}
          <strong>belum otomatis dihitung/dipotong</strong> di slip gaji saat
          Proses Payroll (beda dari PPh 21 yang sudah otomatis). Bagian ini
          cuma panduan cara hitungnya kalau dilakukan manual.
        </p>

        <div>
          <p className="mb-1 font-medium">Aturan umum</p>
          <ul className="grid list-disc gap-1 pl-4 text-muted-foreground">
            <Step>
              Iuran = Gaji (atau Batas Atas Gaji kalau gajinya melebihi batas — cuma berlaku untuk
              BPJS Kesehatan &amp; JP, lihat kolom &quot;Batas Atas Gaji&quot; di form di bawah) × persentase.
            </Step>
            <Step>JHT &amp; JKK/JKM TIDAK punya batas atas gaji — dihitung dari gaji penuh.</Step>
            <Step>JKK &amp; JKM ditanggung 100% perusahaan, tidak memotong gaji pegawai sama sekali.</Step>
          </ul>
        </div>

        <div className="rounded-lg border border-violet-300 bg-white p-3 dark:border-violet-800 dark:bg-violet-900">
          <p className="mb-2 font-medium">Contoh: Gaji Rp5.747.015 (rate default sistem, belum ada Batas Atas Gaji)</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="mb-1 font-medium text-foreground">Dipotong dari gaji pegawai</p>
              <ul className="grid gap-1">
                <Step>Kesehatan (1%): {formatRupiah(kesehatanEmployee)}</Step>
                <Step>JHT (2%): {formatRupiah(jhtEmployee)}</Step>
                <Step>JP (1%): {formatRupiah(jpEmployee)}</Step>
                <Step className="font-medium text-foreground">
                  Total potongan pegawai: <span className="font-semibold">{formatRupiah(totalEmployee)}</span>
                </Step>
              </ul>
            </div>
            <div>
              <p className="mb-1 font-medium text-foreground">Ditanggung perusahaan</p>
              <ul className="grid gap-1">
                <Step>Kesehatan (4%): {formatRupiah(kesehatanCompany)}</Step>
                <Step>JHT (3,7%): {formatRupiah(jhtCompany)}</Step>
                <Step>JP (2%): {formatRupiah(jpCompany)}</Step>
                <Step>JKK (0,24%): {formatRupiah(jkk)}</Step>
                <Step>JKM (0,3%): {formatRupiah(jkm)}</Step>
                <Step className="font-medium text-foreground">
                  Total ditanggung perusahaan: <span className="font-semibold">{formatRupiah(totalCompany)}</span>
                </Step>
              </ul>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-violet-300 bg-white p-3 dark:border-violet-800 dark:bg-violet-900">
          <p className="mb-2 font-medium">Kalau Batas Atas Gaji diisi (contoh umum: BPJS Kesehatan Rp12.000.000/bulan)</p>
          <ul className="grid list-disc gap-1 pl-4">
            <Step>
              Gaji pegawai Rp15.000.000 (di atas batas) → iuran Kesehatan dihitung dari{" "}
              {formatRupiah(12000000)}, BUKAN Rp15.000.000: Kesehatan Pegawai = 12.000.000 × 1% ={" "}
              {formatRupiah(120000)} (bukan Rp150.000).
            </Step>
            <Step>Gaji pegawai Rp8.000.000 (di bawah batas) → iuran dihitung dari gaji penuh Rp8.000.000, batas tidak berlaku.</Step>
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}
