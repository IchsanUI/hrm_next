"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { RefreshCw } from "lucide-react"

export function AutoRefresh({ intervalSeconds = 5 }: { intervalSeconds?: number }) {
  const router = useRouter()
  const routerRef = useRef(router)
  const [secondsLeft, setSecondsLeft] = useState(intervalSeconds)

  useEffect(() => {
    routerRef.current = router
  }, [router])

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft((prev) => Math.max(prev - 1, 0))
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (secondsLeft !== 0) return
    const id = setTimeout(() => {
      routerRef.current.refresh()
      setSecondsLeft(intervalSeconds)
    }, 0)
    return () => clearTimeout(id)
  }, [secondsLeft, intervalSeconds])

  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <RefreshCw className="size-3.5" />
      <span>Refresh otomatis dalam {secondsLeft}d</span>
    </div>
  )
}
