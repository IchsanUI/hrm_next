"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"

import type { BackupScope } from "@prisma/client"
import { BACKUP_SCOPE_LABEL } from "@/lib/backup/table-groups"
import { createBackupAction, getBackupStatusAction } from "@/server/actions/backup"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const SCOPE_OPTIONS: BackupScope[] = ["ALL", "KEPEGAWAIAN", "ABSENSI", "PAYROLL", "IZIN", "SISTEM"]

type JobState =
  | { phase: "idle" }
  | { phase: "running"; publicId: string; tablesDone: number; tablesTotal: number }
  | { phase: "success"; publicId: string; fileSizeBytes: number | null }
  | { phase: "failed"; message: string }

export function BackupTriggerForm() {
  const [scope, setScope] = useState<BackupScope>("ALL")
  const [autoDownload, setAutoDownload] = useState(true)
  const [job, setJob] = useState<JobState>({ phase: "idle" })
  const [isTriggering, startTransition] = useTransition()
  const downloadedRef = useRef(false)

  function handleTrigger() {
    startTransition(async () => {
      const result = await createBackupAction(scope)
      if (result.error || !result.publicId) {
        toast.error(result.error ?? "Gagal memicu backup.")
        return
      }
      downloadedRef.current = false
      setJob({
        phase: "running",
        publicId: result.publicId,
        tablesDone: 0,
        tablesTotal: result.tablesTotal ?? 0,
      })
    })
  }

  // Polling status — cuma jalan selagi job.phase === "running", berhenti
  // sendiri begitu status akhir (SUCCESS/FAILED) didapat. Trigger di atas
  // TIDAK menunggu dump selesai (server action sudah balik duluan), jadi
  // ini satu-satunya cara UI tahu progresnya tanpa memblokir apa pun.
  useEffect(() => {
    if (job.phase !== "running") return
    const publicId = job.publicId
    const interval = setInterval(async () => {
      const status = await getBackupStatusAction(publicId)
      if (status.error) {
        clearInterval(interval)
        setJob({ phase: "failed", message: status.error })
        return
      }
      if (status.status === "SUCCESS") {
        clearInterval(interval)
        setJob({ phase: "success", publicId, fileSizeBytes: status.fileSizeBytes ?? null })
        if (autoDownload && !downloadedRef.current) {
          downloadedRef.current = true
          window.location.href = `/api/backup/${publicId}/download`
        }
        return
      }
      if (status.status === "FAILED") {
        clearInterval(interval)
        setJob({ phase: "failed", message: status.errorMessage ?? "Backup gagal." })
        return
      }
      setJob({
        phase: "running",
        publicId,
        tablesDone: status.tablesDone ?? 0,
        tablesTotal: status.tablesTotal ?? 0,
      })
    }, 1500)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job.phase === "running" ? job.publicId : null])

  const isRunning = job.phase === "running"

  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <Label>Cakupan Backup</Label>
        <Select
          value={scope}
          onValueChange={(value) => setScope(value as BackupScope)}
          disabled={isRunning}
        >
          <SelectTrigger className="w-full sm:w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SCOPE_OPTIONS.map((value) => (
              <SelectItem key={value} value={value}>
                {BACKUP_SCOPE_LABEL[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-2">
        <Label>Tujuan Penyimpanan</Label>
        <div className="grid gap-2">
          <div className="flex items-center gap-2">
            <Checkbox checked disabled />
            <span className="text-sm text-muted-foreground">Simpan di Server (selalu aktif)</span>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              checked={autoDownload}
              onCheckedChange={(checked) => setAutoDownload(checked === true)}
              disabled={isRunning}
            />
            <span className="text-sm">Unduh otomatis setelah selesai</span>
          </div>
          <div className="flex items-center gap-2 opacity-60">
            <Checkbox disabled />
            <span className="text-sm">Google Drive</span>
            <Badge variant="secondary" className="text-[10px]">
              Segera Hadir
            </Badge>
          </div>
          <div className="flex items-center gap-2 opacity-60">
            <Checkbox disabled />
            <span className="text-sm">Amazon S3</span>
            <Badge variant="secondary" className="text-[10px]">
              Segera Hadir
            </Badge>
          </div>
        </div>
      </div>

      <div>
        <Button type="button" onClick={handleTrigger} disabled={isTriggering || isRunning}>
          {isRunning ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Sedang Backup...
            </>
          ) : (
            "Backup Sekarang"
          )}
        </Button>
      </div>

      {job.phase === "running" ? (
        <div className="rounded-lg border bg-muted/40 p-3">
          <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
            <span>Sedang backup...</span>
            <span>
              {job.tablesDone}/{job.tablesTotal || "?"} tabel
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-all"
              style={{
                width: job.tablesTotal > 0 ? `${Math.min(100, (job.tablesDone / job.tablesTotal) * 100)}%` : "10%",
              }}
            />
          </div>
        </div>
      ) : null}

      {job.phase === "success" ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400">
          Backup berhasil
          {job.fileSizeBytes ? ` — ${(job.fileSizeBytes / 1024 / 1024).toFixed(2)} MB` : ""}.{" "}
          <a
            href={`/api/backup/${job.publicId}/download`}
            className="font-medium underline underline-offset-2"
          >
            Unduh
          </a>
        </div>
      ) : null}

      {job.phase === "failed" ? (
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
          Backup gagal: {job.message}
        </div>
      ) : null}
    </div>
  )
}
