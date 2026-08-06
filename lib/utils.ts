import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Nama pegawai sering tersimpan ALL CAPS ("MOCHAMMAD ICHSAN") — dipakai
// buat tampilan yang butuh Title Case ("Mochammad Ichsan"), mis. sapaan
// dashboard. Cuma title-case huruf per kata, tidak menyentuh sisanya.
export function toTitleCase(text: string) {
  return text
    .toLowerCase()
    .split(" ")
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1) : word))
    .join(" ")
}
