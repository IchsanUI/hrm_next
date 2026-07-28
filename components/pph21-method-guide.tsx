"use client"

import { Tabs, TabsList, TabsPanel, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

// Contoh angka di semua tab SENGAJA konsisten (Bruto Rp5.747.015, status
// TK/0) supaya gampang dibandingkan hasil PPh 21-nya antar metode — angka
// ini diambil dari kasus payslip nyata yang sudah diverifikasi manual.
function Step({ children, className }: { children: React.ReactNode; className?: string }) {
  return <li className={className ? `leading-relaxed ${className}` : "leading-relaxed"}>{children}</li>
}

export function Pph21MethodGuide() {
  return (
    <Card className="border-sky-300 bg-sky-100 dark:border-sky-800 dark:bg-sky-950">
      <CardHeader>
        <CardTitle>Panduan Metode Perhitungan PPh 21</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="gross">
          <TabsList>
            <TabsTrigger value="gross">Gross</TabsTrigger>
            <TabsTrigger value="grossup">Gross-Up</TabsTrigger>
            <TabsTrigger value="net">Net</TabsTrigger>
            <TabsTrigger value="ter">TER</TabsTrigger>
          </TabsList>

          <TabsPanel value="gross" className="grid gap-3 text-sm">
            <p className="text-muted-foreground">
              Pegawai menanggung sendiri PPh 21-nya — dipotong langsung dari
              gaji tiap bulan. Pakai tarif progresif Pasal 17 (biaya jabatan
              5% maks Rp500.000/bulan, dikurangi PTKP, lalu kena tarif
              berlapis).
            </p>
            <div className="rounded-lg border border-sky-300 bg-white p-3 dark:border-sky-800 dark:bg-sky-900">
              <p className="mb-2 font-medium">Contoh: Bruto Rp5.747.015, status TK/0</p>
              <ol className="grid list-decimal gap-1 pl-4">
                <Step>Biaya jabatan = min(5.747.015 × 5%, 500.000) = Rp287.350,75</Step>
                <Step>Neto bulanan = 5.747.015 − 287.350,75 = Rp5.459.664,25</Step>
                <Step>Neto setahun = 5.459.664,25 × 12 = Rp65.515.971</Step>
                <Step>PTKP TK/0 = Rp54.000.000 → PKP = Rp11.515.000 (dibulatkan ke bawah kelipatan Rp1.000)</Step>
                <Step>Tarif Pasal 17 lapisan 1 (0–60jt, 5%): 11.515.000 × 5% = Rp575.750/tahun</Step>
                <Step className="font-medium text-foreground">
                  PPh 21 bulanan = 575.750 / 12 = <span className="font-semibold">Rp47.979</span> — dipotong dari gaji
                </Step>
              </ol>
            </div>
          </TabsPanel>

          <TabsPanel value="grossup" className="grid gap-3 text-sm">
            <p className="text-muted-foreground">
              Perusahaan kasih &quot;Tunjangan PPh 21&quot; senilai persis
              pajaknya sendiri, supaya take-home pay pegawai tidak berkurang
              gara-gara pajak. Tunjangan ini sendiri ikut jadi penghasilan
              kena pajak, jadi dicari titik keseimbangannya lewat iterasi
              (bukan rumus tetap) — otomatis menyesuaikan berapa pun lapisan
              tarif yang diatur di halaman ini.
            </p>
            <div className="rounded-lg border border-sky-300 bg-white p-3 dark:border-sky-800 dark:bg-sky-900">
              <p className="mb-2 font-medium">Contoh: Bruto dasar Rp5.747.015, status TK/0</p>
              <ol className="grid list-decimal gap-1 pl-4">
                <Step>Dicari Tunjangan (A) sehingga PPh 21 dari (Bruto + A) = A persis</Step>
                <Step>Hasil iterasi: A ≈ Rp50.375</Step>
                <Step>Bruto baru (setelah tunjangan) = 5.747.015 + 50.375 = Rp5.797.390</Step>
                <Step>PPh 21 dari bruto baru dihitung ulang persis = Rp50.375</Step>
                <Step className="font-medium text-foreground">
                  Slip menampilkan: +Tunjangan PPh 21 Rp50.375 dan −PPh 21 Rp50.375 → net effect{" "}
                  <span className="font-semibold">Rp0</span> (take-home pay sama seperti tanpa pajak)
                </Step>
              </ol>
            </div>
          </TabsPanel>

          <TabsPanel value="net" className="grid gap-3 text-sm">
            <p className="text-muted-foreground">
              Perusahaan menanggung penuh PPh 21 (DTP — Ditanggung
              Perusahaan). Pajaknya tetap dihitung & ditampilkan di slip
              (label &quot;PPh 21 (Ditanggung Perusahaan)&quot;) buat
              keperluan pelaporan, tapi TIDAK memotong gaji pegawai sama
              sekali.
            </p>
            <div className="rounded-lg border border-sky-300 bg-white p-3 dark:border-sky-800 dark:bg-sky-900">
              <p className="mb-2 font-medium">Contoh: Bruto Rp5.747.015, status TK/0</p>
              <ol className="grid list-decimal gap-1 pl-4">
                <Step>PPh 21 dihitung sama persis seperti metode Gross = Rp47.979</Step>
                <Step>Ditampilkan di slip sebagai potongan, tapi TIDAK ikut mengurangi Netto</Step>
                <Step className="font-medium text-foreground">
                  Take-home pay pegawai = Bruto − potongan lain (tanpa PPh 21) ={" "}
                  <span className="font-semibold">lebih besar</span> dari metode Gross
                </Step>
              </ol>
            </div>
          </TabsPanel>

          <TabsPanel value="ter" className="grid gap-3 text-sm">
            <p className="text-muted-foreground">
              Sesuai PMK 168/2023 — dipakai untuk masa pajak Januari–November.
              Rumusnya sederhana: <strong>PPh 21 = Bruto bulan ini × Tarif TER</strong>{" "}
              yang cocok dari tabel &quot;Tarif TER&quot; di bawah, sesuai
              Kategori (A/B/C, ditentukan dari status PTKP pegawai) dan
              lapisan penghasilan brutonya.
            </p>
            <div className="rounded-lg border border-sky-300 bg-white p-3 dark:border-sky-800 dark:bg-sky-900">
              <p className="mb-2 font-medium">Contoh: Bruto Rp5.747.015, status TK/0 (Kategori A)</p>
              <ol className="grid list-decimal gap-1 pl-4">
                <Step>Status TK/0 → Kategori A (lihat pemetaan kategori di kartu Tarif TER)</Step>
                <Step>Cari lapisan bruto yang cocok di tabel Kategori A, mis. tarif 0,50%</Step>
                <Step className="font-medium text-foreground">
                  PPh 21 = 5.747.015 × 0,50% = <span className="font-semibold">Rp28.735</span> — dipotong bulan itu
                </Step>
              </ol>
            </div>
            <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-400">
              <strong>Catatan penting:</strong> masa pajak terakhir (Desember)
              atau saat pegawai resign/pensiun seharusnya direkonsiliasi ulang
              pakai tarif progresif Pasal 17 setahun penuh (dikurangi PPh 21
              yang sudah dipotong TER Jan–Nov). Rekonsiliasi ini{" "}
              <strong>belum diimplementasikan</strong> di sistem — kalau
              metode TER dipilih, tiap periode (termasuk Desember) masih
              dihitung pakai rumus TER apa adanya.
            </p>
          </TabsPanel>
        </Tabs>
      </CardContent>
    </Card>
  )
}
