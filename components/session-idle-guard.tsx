"use client"

import { useEffect, useRef, useState, useTransition } from "react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { idleLogoutAction, logoutAction } from "@/server/actions/logout"

// Kunci localStorage — dibagi antar-tab, supaya aktivitas di tab mana pun
// menunda logout di SEMUA tab, dan logout otomatis di satu tab langsung
// diikuti tab lain (tanpa mencatat log berkali-kali).
const ACTIVITY_KEY = "hris:last-activity"
const LOGOUT_KEY = "hris:idle-logout"
const IDLE_LOGIN_URL = "/login?reason=idle"

const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "wheel"] as const
// Tulis ke localStorage paling sering tiap 5 detik (mousemove sangat sering).
const SHARED_WRITE_INTERVAL_MS = 5_000
// "Ping" /api/auth/session paling sering tiap 1 menit selama user aktif —
// memperpanjang cookie sesi walau user cuma mengisi form panjang tanpa
// pindah halaman (tidak ada request lain ke server).
const SERVER_PING_INTERVAL_MS = 60_000

function readSharedActivity() {
  try {
    return Number(localStorage.getItem(ACTIVITY_KEY)) || 0
  } catch {
    return 0
  }
}

// idleMinutes/warningSeconds = pengaturan Super Admin (SessionPolicy), dikirim
// dari DashboardShell (server) — lihat lib/session-policy.ts.
export function SessionIdleGuard({ idleMinutes, warningSeconds }: { idleMinutes: number; warningSeconds: number }) {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)
  const [isPending, startTransition] = useTransition()
  const lastActivityRef = useRef(0)
  const recordActivityRef = useRef<() => void>(() => {})

  useEffect(() => {
    const idleMs = idleMinutes * 60_000
    const warnAtMs = idleMs - warningSeconds * 1000
    let lastSharedWrite = 0
    let lastPing = Date.now()
    let loggingOut = false

    const recordActivity = () => {
      if (loggingOut) return
      const now = Date.now()
      lastActivityRef.current = now
      if (now - lastSharedWrite >= SHARED_WRITE_INTERVAL_MS) {
        lastSharedWrite = now
        try {
          localStorage.setItem(ACTIVITY_KEY, String(now))
        } catch {
          // localStorage diblokir (mode privat tertentu) — tetap jalan per-tab.
        }
      }
      if (now - lastPing >= SERVER_PING_INTERVAL_MS) {
        lastPing = now
        fetch("/api/auth/session", { cache: "no-store" }).catch(() => {})
      }
    }
    recordActivityRef.current = recordActivity
    recordActivity()

    const goToLogin = () => {
      window.location.href = IDLE_LOGIN_URL
    }

    const check = () => {
      if (loggingOut) return
      const last = Math.max(lastActivityRef.current, readSharedActivity())
      const idle = Date.now() - last
      if (idle >= idleMs) {
        loggingOut = true
        setSecondsLeft(null)
        try {
          localStorage.setItem(LOGOUT_KEY, String(Date.now()))
        } catch {}
        // Server action: catat "Logout Otomatis" ke Log Aktivitas, hapus
        // cookie sesi, lalu redirect ke login. Kalau gagal (mis. jaringan
        // putus), tetap paksa keluar dari halaman.
        idleLogoutAction().catch(goToLogin)
        return
      }
      setSecondsLeft(idle >= warnAtMs ? Math.ceil((idleMs - idle) / 1000) : null)
    }

    // Tab lain sudah melakukan logout otomatis — ikut keluar tanpa mencatat
    // log lagi (cookie sesi sudah dihapus oleh tab tersebut).
    const onStorage = (event: StorageEvent) => {
      if (event.key === LOGOUT_KEY && event.newValue && !loggingOut) {
        loggingOut = true
        goToLogin()
      }
    }

    for (const name of ACTIVITY_EVENTS) {
      window.addEventListener(name, recordActivity, { passive: true, capture: true })
    }
    window.addEventListener("storage", onStorage)
    // Timer browser bisa ditahan saat tab di background / perangkat tidur —
    // cek ulang begitu tab terlihat lagi, jangan menunggu tick berikutnya.
    document.addEventListener("visibilitychange", check)
    const interval = window.setInterval(check, 1000)

    return () => {
      for (const name of ACTIVITY_EVENTS) {
        window.removeEventListener(name, recordActivity, { capture: true })
      }
      window.removeEventListener("storage", onStorage)
      document.removeEventListener("visibilitychange", check)
      window.clearInterval(interval)
    }
  }, [idleMinutes, warningSeconds])

  return (
    <AlertDialog
      open={secondsLeft !== null}
      onOpenChange={(open) => {
        if (!open) recordActivityRef.current()
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Sesi akan segera berakhir</AlertDialogTitle>
          <AlertDialogDescription>
            Tidak ada aktivitas selama hampir {idleMinutes} menit. Demi keamanan, Anda akan keluar otomatis dalam{" "}
            <span className="font-semibold text-foreground tabular-nums">{secondsLeft ?? 0} detik</span>.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending} onClick={() => startTransition(() => logoutAction())}>
            Keluar Sekarang
          </AlertDialogCancel>
          <AlertDialogAction disabled={isPending} onClick={() => recordActivityRef.current()}>
            Tetap Masuk
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
