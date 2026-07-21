"use client"

import { useState, useTransition, type FormEvent } from "react"
import { toast } from "sonner"

import { updateIzinTypeSettingAction } from "@/server/actions/izin-type-settings"
import { IZIN_TYPES_WITH_CUTOFF, type IzinTypeSettingRow } from "@/lib/izin-type-settings-constants"
import { LEAVE_TYPES } from "@/lib/leave-types"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

function SettingRow({ setting }: { setting: IzinTypeSettingRow }) {
  const leaveTypeOption = LEAVE_TYPES.find((t) => t.value === setting.leaveType)
  const hasCutoff = IZIN_TYPES_WITH_CUTOFF.has(setting.leaveType)

  const [isActive, setIsActive] = useState(setting.isActive)
  const [cutoff, setCutoff] = useState(setting.submissionCutoffTime ?? "")
  const [isPending, startTransition] = useTransition()

  if (!leaveTypeOption) return null
  const Icon = leaveTypeOption.icon
  const label = leaveTypeOption.label

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    startTransition(async () => {
      const result = await updateIzinTypeSettingAction(setting.leaveType, undefined, formData)
      if (result?.error) {
        toast.error(result.error)
      } else {
        toast.success(`Pengaturan "${label}" berhasil disimpan.`)
      }
    })
  }

  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-2">
          <Icon className="size-4 shrink-0 text-muted-foreground" />
          <div>
            <p className="font-medium">{leaveTypeOption.label}</p>
            <p className="text-xs text-muted-foreground">{leaveTypeOption.description}</p>
          </div>
        </div>
      </TableCell>
      <TableCell>
        <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={isActive}
              onCheckedChange={(checked) => setIsActive(checked === true)}
            />
            {/* Checkbox custom (base-ui) tidak ikut form submission native — kirim state lewat hidden input */}
            <input type="hidden" name="isActive" value={isActive ? "on" : "off"} />
            Aktif
          </label>

          {hasCutoff ? (
            <div className="flex items-center gap-2">
              <Label htmlFor={`cutoff-${setting.leaveType}`} className="text-sm text-muted-foreground">
                Batas jam pengajuan
              </Label>
              <Input
                id={`cutoff-${setting.leaveType}`}
                name="submissionCutoffTime"
                type="time"
                className="w-28"
                value={cutoff}
                onChange={(e) => setCutoff(e.target.value)}
              />
            </div>
          ) : null}

          <Button type="submit" size="sm" disabled={isPending}>
            {isPending ? "Menyimpan..." : "Simpan"}
          </Button>
        </form>
      </TableCell>
    </TableRow>
  )
}

export function IzinTypeSettingsTable({ settings }: { settings: IzinTypeSettingRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Jenis Izin</TableHead>
          <TableHead>Pengaturan</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {settings.map((setting) => (
          <SettingRow key={setting.leaveType} setting={setting} />
        ))}
      </TableBody>
    </Table>
  )
}
