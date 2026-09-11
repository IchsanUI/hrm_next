"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Pause, Play, RefreshCw } from "lucide-react"

import { Button } from "@/components/ui/button"

export function AutoRefresh({ intervalSeconds = 5 }: { intervalSeconds?: number }) {
  const router = useRouter()
  const routerRef = useRef(router)
  const [secondsLeft, setSecondsLeft] = useState(intervalSeconds)
  // Bisa dijeda karena refresh otomatis memuat ulang data tabel, dan tabel
  // yang datanya berubah otomatis balik ke halaman 1 (perilaku bawaan
  // TanStack Table, lihat components/data-table.tsx) — bikin penelusuran
  // audit di halaman ke-2 dan seterusnya terus terlempar ke awal.
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    routerRef.current = router
  }, [router])

  useEffect(() => {
    if (paused) return
    const timer = setInterval(() => {
      setSecondsLeft((prev) => Math.max(prev - 1, 0))
    }, 1000)
    return () => clearInterval(timer)
  }, [paused])

  useEffect(() => {
    if (paused || secondsLeft !== 0) return
    const id = setTimeout(() => {
      routerRef.current.refresh()
      setSecondsLeft(intervalSeconds)
    }, 0)
    return () => clearTimeout(id)
  }, [paused, secondsLeft, intervalSeconds])

  // Menjeda tidak boleh berarti terkunci dengan data basi — tetap sediakan
  // cara memuat ulang sekali jalan, tanpa menyalakan lagi hitungannya.
  const refreshNow = useCallback(() => {
    routerRef.current.refresh()
    setSecondsLeft(intervalSeconds)
  }, [intervalSeconds])

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <RefreshCw className={paused ? "size-3.5" : "size-3.5 animate-spin [animation-duration:3s]"} />
      <span>
        {paused ? "Refresh otomatis dijeda" : `Refresh otomatis dalam ${secondsLeft}d`}
      </span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 px-2"
        onClick={() => {
          setPaused((prev) => !prev)
          setSecondsLeft(intervalSeconds)
        }}
      >
        {paused ? <Play className="size-3.5" /> : <Pause className="size-3.5" />}
        {paused ? "Lanjutkan" : "Jeda"}
      </Button>
      {paused ? (
        <Button type="button" variant="outline" size="sm" className="h-7 px-2" onClick={refreshNow}>
          <RefreshCw className="size-3.5" />
          Muat Ulang
        </Button>
      ) : null}
    </div>
  )
}
