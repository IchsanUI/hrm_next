"use client"

import { useEffect, useState, useTransition } from "react"
import { Bell, BellOff } from "lucide-react"
import { toast } from "sonner"

import { subscribeToPushAction, unsubscribeFromPushAction } from "@/server/actions/push-subscription"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

// VAPID public key dikirim server sebagai base64url, tapi
// pushManager.subscribe() butuh Uint8Array — konversi standar sesuai spek
// Web Push (lihat MDN: "applicationServerKey").
function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)))
}

type Status = "unsupported" | "not-configured" | "checking" | "subscribed" | "unsubscribed"

export function PushNotificationToggle({ initiallySubscribed }: { initiallySubscribed: boolean }) {
  const [status, setStatus] = useState<Status>("checking")
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (!VAPID_PUBLIC_KEY) {
      setStatus("not-configured")
      return
    }
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setStatus("unsupported")
      return
    }

    navigator.serviceWorker.ready
      .then((registration) => registration.pushManager.getSubscription())
      .then((sub) => setStatus(sub ? "subscribed" : "unsubscribed"))
      .catch(() => setStatus(initiallySubscribed ? "subscribed" : "unsubscribed"))
  }, [initiallySubscribed])

  function handleEnable() {
    startTransition(async () => {
      try {
        const permission = await Notification.requestPermission()
        if (permission !== "granted") {
          toast.error("Izin notifikasi ditolak. Aktifkan lewat pengaturan browser kalau berubah pikiran.")
          return
        }

        const registration = await navigator.serviceWorker.ready
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY!),
        })

        const json = subscription.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } }
        const result = await subscribeToPushAction(
          { endpoint: json.endpoint, keys: json.keys },
          navigator.userAgent
        )
        if (result?.error) {
          toast.error(result.error)
          return
        }
        setStatus("subscribed")
        toast.success("Notifikasi push berhasil diaktifkan di perangkat ini.")
      } catch (err) {
        console.error(err)
        toast.error("Gagal mengaktifkan notifikasi push.")
      }
    })
  }

  function handleDisable() {
    startTransition(async () => {
      try {
        const registration = await navigator.serviceWorker.ready
        const subscription = await registration.pushManager.getSubscription()
        if (subscription) {
          const endpoint = subscription.endpoint
          await subscription.unsubscribe()
          await unsubscribeFromPushAction(endpoint)
        }
        setStatus("unsubscribed")
        toast.success("Notifikasi push dinonaktifkan di perangkat ini.")
      } catch (err) {
        console.error(err)
        toast.error("Gagal menonaktifkan notifikasi push.")
      }
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notifikasi Push</CardTitle>
        <CardDescription>
          Terima notifikasi HRIS langsung dari browser/perangkat ini, walau tab-nya sedang tidak
          dibuka (mis. ada pengajuan izin yang perlu Anda setujui).
        </CardDescription>
      </CardHeader>
      <CardContent>
        {status === "unsupported" ? (
          <p className="text-sm text-muted-foreground">Browser ini tidak mendukung notifikasi push.</p>
        ) : status === "not-configured" ? (
          <p className="text-sm text-muted-foreground">Fitur ini belum diaktifkan oleh admin sistem.</p>
        ) : status === "checking" ? (
          <p className="text-sm text-muted-foreground">Memeriksa status...</p>
        ) : status === "subscribed" ? (
          <Button type="button" variant="outline" disabled={isPending} onClick={handleDisable}>
            <BellOff className="size-3.5" />
            {isPending ? "Memproses..." : "Nonaktifkan Notifikasi Push"}
          </Button>
        ) : (
          <Button type="button" disabled={isPending} onClick={handleEnable}>
            <Bell className="size-3.5" />
            {isPending ? "Memproses..." : "Aktifkan Notifikasi Push di Perangkat Ini"}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
