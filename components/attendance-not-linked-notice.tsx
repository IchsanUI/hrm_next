import { Unlink } from "lucide-react"

// Beda dari ModuleBlueprintPage (buat modul yang BENERAN belum dikembangkan)
// — fitur Riwayat Absensi sudah aktif, cuma pegawai ini belum dipetakan ke
// PIN mesin fingerprint. Pesannya harus jelas ini masalah data/konfigurasi
// akun, bukan modulnya belum jadi, supaya pegawai tahu harus hubungi
// Admin/IT, bukan menunggu fitur baru dirilis.
export function AttendanceNotLinkedNotice() {
  return (
    <div className="flex flex-col items-center gap-3 py-8 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400">
        <Unlink className="size-6" />
      </span>
      <div>
        <p className="font-medium">Belum Terhubung ke Mesin Absensi</p>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Akun Anda belum dipetakan ke PIN mesin fingerprint, jadi kehadiran belum bisa
          tercatat otomatis. Hubungi Admin/IT untuk memetakan PIN absensi Anda.
        </p>
      </div>
    </div>
  )
}
