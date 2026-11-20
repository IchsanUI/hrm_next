"use client"

import { useActionState, useEffect, useState } from "react"
import Link from "next/link"
import {
  KeyRound,
  Laptop,
  LogIn,
  LogOut,
  MonitorSmartphone,
  ShieldAlert,
  Smartphone,
  Tablet,
  TimerOff,
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import type { DeviceKind } from "@/lib/user-agent"
import { reportSuspiciousLoginAction, type ReportLoginState } from "@/server/actions/login-activity"

const PAGE_SIZE = 15

export type LoginActivityItem = {
  id: number
  action: "LOGIN" | "LOGIN_FAILED" | "LOGOUT" | "LOGOUT_IDLE"
  deviceLabel: string
  deviceKind: DeviceKind
  ipAddress: string | null
  timeLabel: string // sudah diformat di server (WIB)
  relativeLabel: string
  isCurrentDevice: boolean
  reportedTicket: string | null
}

const ACTION_META: Record<LoginActivityItem["action"], { label: string; icon: typeof LogIn; tone: string }> = {
  LOGIN: { label: "Login berhasil", icon: LogIn, tone: "text-emerald-600 dark:text-emerald-400" },
  LOGIN_FAILED: { label: "Percobaan login gagal", icon: ShieldAlert, tone: "text-red-600 dark:text-red-400" },
  LOGOUT: { label: "Logout", icon: LogOut, tone: "text-muted-foreground" },
  LOGOUT_IDLE: { label: "Logout otomatis (tidak aktif)", icon: TimerOff, tone: "text-muted-foreground" },
}

function DeviceIcon({ kind, className }: { kind: DeviceKind; className?: string }) {
  const Icon = kind === "mobile" ? Smartphone : kind === "tablet" ? Tablet : kind === "desktop" ? Laptop : MonitorSmartphone
  return <Icon className={className} />
}

export function LoginActivityList({
  items,
  canReport,
  passwordHref,
}: {
  items: LoginActivityItem[]
  canReport: boolean
  passwordHref: string
}) {
  const [target, setTarget] = useState<LoginActivityItem | null>(null)
  const [page, setPage] = useState(0)
  const pageCount = Math.ceil(items.length / PAGE_SIZE)
  const pageItems = items.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  if (items.length === 0) {
    return <p className="px-4 py-10 text-center text-sm text-muted-foreground">Belum ada aktivitas login tercatat.</p>
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-4">Waktu</TableHead>
            <TableHead>Perangkat</TableHead>
            <TableHead>Aktivitas</TableHead>
            <TableHead>Alamat IP</TableHead>
            <TableHead className="pr-4 text-right">Aksi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pageItems.map((item) => {
            const meta = ACTION_META[item.action]
            const ActionIcon = meta.icon
            const reportable =
              canReport && (item.action === "LOGIN" || item.action === "LOGIN_FAILED") && !item.isCurrentDevice
            return (
              <TableRow key={item.id}>
                <TableCell className="pl-4 align-top whitespace-nowrap">
                  <p className="font-medium">{item.timeLabel}</p>
                  <p className="text-xs text-muted-foreground">{item.relativeLabel}</p>
                </TableCell>
                <TableCell className="align-top whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <DeviceIcon kind={item.deviceKind} className="size-4 shrink-0 text-muted-foreground" />
                    <span>{item.deviceLabel}</span>
                    {item.isCurrentDevice ? (
                      <Badge
                        variant="secondary"
                        className="bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300"
                      >
                        Perangkat ini
                      </Badge>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell className="align-top whitespace-nowrap">
                  <span className={`inline-flex items-center gap-1.5 ${meta.tone}`}>
                    <ActionIcon className="size-4 shrink-0" />
                    {meta.label}
                  </span>
                </TableCell>
                <TableCell className="align-top font-mono text-xs whitespace-nowrap text-muted-foreground">
                  {item.ipAddress ?? "-"}
                </TableCell>
                <TableCell className="pr-4 text-right align-top whitespace-nowrap">
                  {item.reportedTicket ? (
                    <Badge variant="outline" className="border-amber-400 text-amber-700 dark:text-amber-300">
                      Dilaporkan · {item.reportedTicket}
                    </Badge>
                  ) : reportable ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-500/10"
                      onClick={() => setTarget(item)}
                    >
                      Ini bukan saya
                    </Button>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-3 text-sm text-muted-foreground">
        <span>
          {items.length} data
          {pageCount > 1 ? ` — halaman ${page + 1} dari ${pageCount}` : null}
        </span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setPage((p) => p - 1)} disabled={page === 0}>
            Sebelumnya
          </Button>
          <Button variant="outline" size="sm" onClick={() => setPage((p) => p + 1)} disabled={page >= pageCount - 1}>
            Berikutnya
          </Button>
        </div>
      </div>

      <ReportDialog item={target} onClose={() => setTarget(null)} passwordHref={passwordHref} />
    </>
  )
}

function ReportDialog({
  item,
  onClose,
  passwordHref,
}: {
  item: LoginActivityItem | null
  onClose: () => void
  passwordHref: string
}) {
  return (
    <Dialog open={item !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        {/* key → form & state di-reset tiap membuka baris lain */}
        {item ? <ReportForm key={item.id} item={item} onClose={onClose} passwordHref={passwordHref} /> : null}
      </DialogContent>
    </Dialog>
  )
}

function ReportForm({
  item,
  onClose,
  passwordHref,
}: {
  item: LoginActivityItem
  onClose: () => void
  passwordHref: string
}) {
  const [state, formAction, isPending] = useActionState<ReportLoginState, FormData>(reportSuspiciousLoginAction, undefined)

  useEffect(() => {
    if (state?.error) toast.error(state.error)
    if (state?.ticketNumber) toast.success(`Laporan terkirim (${state.ticketNumber}). Admin akan menindaklanjuti.`)
  }, [state])

  if (state?.ticketNumber) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>Laporan terkirim</DialogTitle>
          <DialogDescription>
            Tiket <span className="font-semibold text-foreground">{state.ticketNumber}</span> sudah diteruskan ke Super Admin
            untuk ditindaklanjuti. Pantau statusnya di menu Laporkan Kendala.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-start gap-2.5 rounded-lg border border-amber-300 bg-amber-50 px-3.5 py-3 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
          <KeyRound className="mt-0.5 size-4 shrink-0" />
          <p>Segera ganti password Anda supaya orang lain tidak bisa masuk lagi ke akun Anda.</p>
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Tutup</DialogClose>
          <Button nativeButton={false} render={<Link href={passwordHref} onClick={onClose} />}>
            Ganti Password
          </Button>
        </DialogFooter>
      </>
    )
  }

  return (
    <form action={formAction} className="grid gap-4">
      <input type="hidden" name="logId" value={item.id} />
      <DialogHeader>
        <DialogTitle>Laporkan: ini bukan saya</DialogTitle>
        <DialogDescription>
          Aktivitas berikut akan dilaporkan ke Super Admin sebagai aktivitas mencurigakan pada akun Anda.
        </DialogDescription>
      </DialogHeader>
      <div className="rounded-lg border bg-muted/40 px-3.5 py-3 text-sm">
        <p className="font-medium">{ACTION_META[item.action].label}</p>
        <p className="mt-1 text-muted-foreground">{item.timeLabel} WIB</p>
        <p className="text-muted-foreground">
          {item.deviceLabel}
          {item.ipAddress ? ` · IP ${item.ipAddress}` : ""}
        </p>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="report-note">Keterangan tambahan (opsional)</Label>
        <Textarea
          id="report-note"
          name="note"
          rows={3}
          maxLength={1000}
          placeholder="Mis. saya tidak pernah memakai perangkat ini / saat itu saya sedang cuti."
        />
      </div>
      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" />}>Batal</DialogClose>
        <Button type="submit" variant="destructive" disabled={isPending}>
          {isPending ? "Mengirim..." : "Kirim Laporan"}
        </Button>
      </DialogFooter>
    </form>
  )
}
