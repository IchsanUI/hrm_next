"use client"

import { useEffect, useRef } from "react"
import { toast } from "sonner"

// Untuk form berbasis useActionState yang tetap di halaman yang sama
// (tidak redirect) setelah submit — mendeteksi transisi isPending true -> false
// untuk memicu toast sukses/error, karena state sukses & initial sama-sama
// bisa berbentuk `undefined`.
export function useFormActionToast(
  isPending: boolean,
  error: string | undefined,
  successMessage: string
) {
  const wasPending = useRef(false)

  useEffect(() => {
    if (wasPending.current && !isPending) {
      if (error) {
        toast.error(error)
      } else {
        toast.success(successMessage)
      }
    }
    wasPending.current = isPending
  }, [isPending, error, successMessage])
}
