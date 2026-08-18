"use client"

import { useEffect, useState } from "react"

// WIB/WITA/WIT ditentukan dari offset UTC PERANGKAT yang membuka halaman
// (bukan asumsi server) — supaya tetap benar kalau suatu saat dibuka dari
// luar Gresik/Jawa Timur. Offset di luar 3 zona Indonesia (mis. WNs yang
// browser-nya di-set ke timezone lain) fallback ke WIB, zona paling umum
// dipakai pengguna aplikasi ini.
function timezoneLabel(offsetMinutes: number): string {
  const offsetHours = -offsetMinutes / 60 // getTimezoneOffset() kebalik tandanya
  if (offsetHours === 8) return "WITA"
  if (offsetHours === 9) return "WIT"
  return "WIB"
}

export function LiveClock() {
  const [now, setNow] = useState<Date | null>(null)

  useEffect(() => {
    setNow(new Date())
    const interval = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  // null di render pertama (server vs client jam beda sepersekian detik) —
  // hindari hydration mismatch, isi begitu mount di client.
  if (!now) return null

  const time = now.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
  const date = now.toLocaleDateString("id-ID", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  })

  return (
    <div className="flex items-center text-muted-foreground">
      <div className="leading-tight">
        {/* Sengaja disamakan ukurannya dengan <h1> nama pegawai (lihat
            employee-dashboard-content.tsx) — text-3xl sm:text-4xl
            font-bold — supaya jam & nama jadi dua elemen yang setara
            secara visual, bukan jam terasa "cuma info kecil" di
            sampingnya. */}
        <p className="text-3xl font-bold tabular-nums text-foreground sm:text-4xl">
          {time}
          <span className="ml-1.5 text-base font-semibold text-muted-foreground sm:text-lg">
            {timezoneLabel(now.getTimezoneOffset())}
          </span>
        </p>
        <p className="text-xs sm:text-sm">{date}</p>
      </div>
    </div>
  )
}
