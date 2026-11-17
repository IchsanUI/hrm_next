// Angka → kata dalam Bahasa Indonesia, untuk "terbilang" di surat.
// Contoh: 2691037 → "Dua Juta Enam Ratus Sembilan Puluh Satu Ribu Tiga Puluh Tujuh Rupiah".

const SATUAN = ["", "Satu", "Dua", "Tiga", "Empat", "Lima", "Enam", "Tujuh", "Delapan", "Sembilan", "Sepuluh", "Sebelas"]

function words(n: number): string {
  if (n < 12) return SATUAN[n]
  if (n < 20) return `${SATUAN[n - 10]} Belas`
  if (n < 100) return `${SATUAN[Math.floor(n / 10)]} Puluh ${words(n % 10)}`
  if (n < 200) return `Seratus ${words(n - 100)}`
  if (n < 1000) return `${SATUAN[Math.floor(n / 100)]} Ratus ${words(n % 100)}`
  if (n < 2000) return `Seribu ${words(n - 1000)}`
  if (n < 1_000_000) return `${words(Math.floor(n / 1000))} Ribu ${words(n % 1000)}`
  if (n < 1_000_000_000) return `${words(Math.floor(n / 1_000_000))} Juta ${words(n % 1_000_000)}`
  if (n < 1_000_000_000_000) return `${words(Math.floor(n / 1_000_000_000))} Miliar ${words(n % 1_000_000_000)}`
  return `${words(Math.floor(n / 1_000_000_000_000))} Triliun ${words(n % 1_000_000_000_000)}`
}

export function terbilang(value: number): string {
  const n = Math.round(Math.abs(value))
  if (n === 0) return "Nol Rupiah"
  return `${words(n).replace(/\s+/g, " ").trim()} Rupiah`
}

// Format nominal gaya surat: "Rp.2.691.037,-"
export function formatRupiahLetter(value: number) {
  return `Rp.${Math.round(value).toLocaleString("id-ID")},-`
}
