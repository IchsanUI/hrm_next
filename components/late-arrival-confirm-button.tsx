"use client"

import { useTransition } from "react"
import { toast } from "sonner"
import { MapPin } from "lucide-react"

import { confirmArrivalAction } from "@/server/actions/late-arrival"
import { Button } from "@/components/ui/button"

function getLocation(): Promise<{ lat: number; lng: number } | undefined> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(undefined)
      return
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
      () => resolve(undefined),
      { enableHighAccuracy: true, timeout: 10000 }
    )
  })
}

export function LateArrivalConfirmButton({ requestId }: { requestId: number }) {
  const [isPending, startTransition] = useTransition()

  function handleClick() {
    startTransition(async () => {
      const location = await getLocation()
      const result = await confirmArrivalAction(requestId, location)
      if (result?.error) {
        toast.error(result.error)
      } else {
        toast.success("Kedatangan Anda berhasil dikonfirmasi.")
      }
    })
  }

  return (
    <Button onClick={handleClick} disabled={isPending}>
      <MapPin className="size-3.5" />
      {isPending ? "Mengonfirmasi..." : "Konfirmasi: Saya Sudah di Kantor"}
    </Button>
  )
}
