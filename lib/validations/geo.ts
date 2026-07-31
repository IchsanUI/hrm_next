import { z } from "zod"

// Koordinat GPS WAJIB (bukan opsional) — dipakai form yang mengharuskan
// lokasi (Lembur, Absen Diluar Kantor, Terlambat — lihat
// components/location-required-field.tsx). z.coerce.number() biasa akan
// meloloskan string kosong sebagai 0 (Number("") === 0 di JS), jadi dipakai
// z.preprocess supaya string kosong/bukan-angka ditolak sebagai "tidak ada",
// bukan diam-diam jadi koordinat 0.
export function requiredCoordinateSchema(min: number, max: number) {
  return z.preprocess((val) => {
    if (typeof val !== "string" || val.trim() === "") return undefined
    const num = Number(val)
    return Number.isFinite(num) ? num : undefined
  }, z.number("Lokasi wajib diaktifkan").min(min, "Lokasi wajib diaktifkan").max(max, "Lokasi wajib diaktifkan"))
}
