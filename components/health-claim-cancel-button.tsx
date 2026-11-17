"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { cancelHealthClaimAction } from "@/server/actions/health-claims"

export function HealthClaimCancelButton({ publicId, claimNumber }: { publicId: string; claimNumber: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button variant="outline" disabled={isPending} />}>Batalkan Klaim</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Batalkan klaim {claimNumber}?</AlertDialogTitle>
          <AlertDialogDescription>
            Klaim yang dibatalkan tidak bisa diaktifkan lagi. Plafon yang tertahan akan dikembalikan.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Tidak</AlertDialogCancel>
          <AlertDialogAction
            onClick={() =>
              startTransition(async () => {
                const result = await cancelHealthClaimAction(publicId)
                if ("error" in result) toast.error(result.error)
                else {
                  toast.success(result.success)
                  router.refresh()
                }
              })
            }
          >
            Ya, batalkan
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
