"use client"

import { useState } from "react"

import { Input } from "@/components/ui/input"

// Input angka dengan pemisah ribuan ala Rupiah saat diketik (mis. ketik
// "700000" langsung tampil "700.000") — nilai mentah (tanpa titik) yang
// dikirim ke server lewat hidden input bernama `name`, bukan `display`.
export function RupiahInput({
  id,
  name,
  defaultValue,
  disabled,
}: {
  id: string
  name: string
  defaultValue?: number
  disabled?: boolean
}) {
  const [raw, setRaw] = useState(defaultValue ? String(defaultValue) : "")
  const display = raw ? Number(raw).toLocaleString("id-ID") : ""

  return (
    <>
      <Input
        id={id}
        inputMode="numeric"
        placeholder="0"
        value={display}
        disabled={disabled}
        onChange={(event) => setRaw(event.target.value.replace(/\D/g, ""))}
      />
      <input type="hidden" name={name} value={raw} />
    </>
  )
}
