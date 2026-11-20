// Ringkasan perangkat dari header User-Agent (tersimpan di ActivityLog.userAgent)
// — cukup untuk ditampilkan ke pengguna ("Chrome · Windows"), bukan deteksi
// yang sempurna. Dipakai Log Aktivitas admin & Aktivitas Login pegawai.

export type DeviceKind = "mobile" | "tablet" | "desktop" | "unknown"

export type DeviceInfo = {
  browser: string
  os: string
  kind: DeviceKind
  label: string
}

export function describeDevice(userAgent: string | null | undefined): DeviceInfo {
  if (!userAgent) return { browser: "-", os: "-", kind: "unknown", label: "Perangkat tidak dikenal" }
  const ua = userAgent

  const os = /Windows/.test(ua)
    ? "Windows"
    : /iPhone|iPad|iPod/.test(ua)
      ? "iOS"
      : /Android/.test(ua)
        ? "Android"
        : /Mac OS X|Macintosh/.test(ua)
          ? "macOS"
          : /CrOS/.test(ua)
            ? "ChromeOS"
            : /Linux/.test(ua)
              ? "Linux"
              : "OS Lain"

  // Urutan penting: banyak browser menyertakan "Chrome/" & "Safari/" juga.
  const browser = /Edg(e|A|iOS)?\//.test(ua)
    ? "Edge"
    : /OPR\/|Opera/.test(ua)
      ? "Opera"
      : /SamsungBrowser\//.test(ua)
        ? "Samsung Internet"
        : /Firefox\/|FxiOS\//.test(ua)
          ? "Firefox"
          : /Chrome\/|CriOS\//.test(ua)
            ? "Chrome"
            : /Safari\//.test(ua)
              ? "Safari"
              : "Browser Lain"

  const kind: DeviceKind = /iPad|Tablet/.test(ua) || (/Android/.test(ua) && !/Mobile/.test(ua))
    ? "tablet"
    : /Mobi|iPhone|Android/.test(ua)
      ? "mobile"
      : "desktop"

  return { browser, os, kind, label: `${browser} · ${os}` }
}
