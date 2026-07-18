"use client"

import { Suspense, useEffect } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"

const TOAST_MESSAGES: Record<string, string> = {
  "employee-updated": "Data pegawai berhasil diperbarui.",
  "username-updated": "Username berhasil diubah. Silakan login kembali.",
  "password-updated": "Password berhasil diubah. Silakan login kembali.",
  "overtime-submitted": "Pengajuan izin lembur berhasil dikirim, menunggu approval atasan.",
}

function ToastListenerInner() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    const key = searchParams.get("toast")
    if (!key) return

    const message = TOAST_MESSAGES[key] ?? "Berhasil disimpan."
    toast.success(message)

    const params = new URLSearchParams(searchParams)
    params.delete("toast")
    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, pathname])

  return null
}

export function ToastListener() {
  return (
    <Suspense fallback={null}>
      <ToastListenerInner />
    </Suspense>
  )
}
