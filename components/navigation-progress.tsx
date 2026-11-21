"use client"

import { useEffect, useRef, useState } from "react"
import { usePathname, useSearchParams } from "next/navigation"

// Garis progres tipis di atas layar saat pindah halaman. Mulai begitu link
// internal diklik (tanpa menunggu server), selesai saat URL berubah. Ikut
// menangani perpindahan tab/filter (?tab=…) yang tidak memicu loading.tsx.
// Tanpa dependensi tambahan — cukup mendengarkan klik <a> di dokumen.

const START_DELAY_MS = 120 // perpindahan secepat ini tidak perlu indikator
const SAFETY_TIMEOUT_MS = 15_000

function isInternalNavigation(event: MouseEvent): boolean {
  if (event.defaultPrevented || event.button !== 0) return false
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false
  const anchor = (event.target as HTMLElement | null)?.closest("a")
  if (!anchor || !anchor.href) return false
  if (anchor.target && anchor.target !== "_self") return false
  if (anchor.hasAttribute("download")) return false
  const url = new URL(anchor.href, window.location.href)
  if (url.origin !== window.location.origin) return false
  // File/API (PDF, Excel) bukan perpindahan halaman.
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/uploads/")) return false
  // Hanya beda hash, atau link ke halaman yang sama persis → tidak berpindah.
  return !(url.pathname === window.location.pathname && url.search === window.location.search)
}

type Phase = "idle" | "loading" | "done"

export function NavigationProgress() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [phase, setPhase] = useState<Phase>("idle")
  const [progress, setProgress] = useState(0)
  const ctl = useRef({
    phase: "idle" as Phase,
    timers: [] as ReturnType<typeof setTimeout>[],
    trickle: null as ReturnType<typeof setInterval> | null,
  })

  // Fungsi kontrol disimpan sekali (setter state stabil) supaya bisa dipakai
  // di event listener & effect tanpa ikut menjadi dependensi.
  const api = useRef({
    clear() {
      const c = ctl.current
      c.timers.forEach(clearTimeout)
      c.timers = []
      if (c.trickle) clearInterval(c.trickle)
      c.trickle = null
    },
    set(next: Phase) {
      ctl.current.phase = next
      setPhase(next)
    },
    start() {
      const c = ctl.current
      api.current.clear()
      c.timers.push(
        setTimeout(() => {
          api.current.set("loading")
          setProgress(12)
          // Merayap pelan mendekati 90% selama menunggu server.
          c.trickle = setInterval(() => setProgress((p) => (p < 90 ? p + (90 - p) * 0.08 : p)), 200)
        }, START_DELAY_MS),
        setTimeout(() => api.current.finish(), SAFETY_TIMEOUT_MS)
      )
    },
    finish() {
      const c = ctl.current
      api.current.clear()
      if (c.phase === "idle") return
      setProgress(100)
      api.current.set("done")
      c.timers.push(
        setTimeout(() => {
          api.current.set("idle")
          setProgress(0)
        }, 350)
      )
    },
  })

  useEffect(() => {
    const controls = api.current
    const onClick = (event: MouseEvent) => {
      if (isInternalNavigation(event)) controls.start()
    }
    document.addEventListener("click", onClick, true)
    return () => {
      document.removeEventListener("click", onClick, true)
      controls.clear()
    }
  }, [])

  // Selesai saat URL (path atau query) benar-benar berubah.
  const url = `${pathname}?${searchParams.toString()}`
  const lastUrl = useRef(url)
  useEffect(() => {
    if (lastUrl.current === url) return
    lastUrl.current = url
    api.current.finish()
  }, [url])

  if (phase === "idle") return null
  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-[3px]">
      <div
        className="h-full bg-gradient-to-r from-sky-400 via-primary to-amber-400 shadow-[0_0_8px_rgba(59,130,246,0.7)] transition-[width,opacity] duration-300 ease-out"
        style={{ width: `${progress}%`, opacity: phase === "done" ? 0 : 1 }}
      />
    </div>
  )
}
