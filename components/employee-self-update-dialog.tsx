"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { UserPen } from "lucide-react"

import { setEmployeeSelfUpdateAction, setEmployeesSelfUpdateBatchAction } from "@/server/actions/employees"
import {
  DEFAULT_SELF_UPDATE_GROUPS,
  SELF_UPDATE_GROUPS,
  parseSelfUpdateGroups,
  type SelfUpdateGroupKey,
} from "@/lib/self-update-fields"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

// Dialog pemilihan grup data Update Mandiri (lib/self-update-fields.ts) —
// dipakai tombol per pegawai & tombol batch di Data Pegawai.
function SelfUpdateGroupsDialog({
  open,
  onOpenChange,
  title,
  initial,
  isPending,
  saveLabel,
  deactivateLabel,
  onSave,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  initial: SelfUpdateGroupKey[]
  isPending: boolean
  saveLabel: string
  // null = tombol nonaktifkan disembunyikan.
  deactivateLabel: string | null
  onSave: (groups: SelfUpdateGroupKey[]) => void
}) {
  const [selected, setSelected] = useState<SelfUpdateGroupKey[]>(initial)
  const allSelected = selected.length === SELF_UPDATE_GROUPS.length

  function toggle(key: SelfUpdateGroupKey, checked: boolean) {
    setSelected((prev) => (checked ? [...prev, key] : prev.filter((k) => k !== key)))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Pilih data yang boleh diperbarui pegawai sendiri lewat menu Update Data. Izin otomatis terkunci lagi setelah
            pegawai menyimpan. Data inti kepegawaian, NIK, NPWP/PTKP, TTD, dan data keluarga tetap hanya bisa diubah HR.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-1">
          <div className="flex items-center gap-2 border-b pb-2">
            <Checkbox
              id="self-update-all"
              checked={allSelected}
              indeterminate={selected.length > 0 && !allSelected}
              onCheckedChange={(checked) => setSelected(checked === true ? SELF_UPDATE_GROUPS.map((g) => g.key) : [])}
            />
            <Label htmlFor="self-update-all" className="text-sm font-medium">
              Pilih semua
            </Label>
          </div>
          <div className="grid gap-x-4 gap-y-2.5 pt-2 sm:grid-cols-2">
            {SELF_UPDATE_GROUPS.map((group) => (
              <div key={group.key} className="flex items-start gap-2">
                <Checkbox
                  id={`self-update-${group.key}`}
                  className="mt-0.5"
                  checked={selected.includes(group.key)}
                  onCheckedChange={(checked) => toggle(group.key, checked === true)}
                />
                <Label htmlFor={`self-update-${group.key}`} className="grid gap-0.5 text-sm font-normal">
                  <span className="font-medium">{group.label}</span>
                  <span className="text-xs text-muted-foreground">{group.description}</span>
                </Label>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          {deactivateLabel ? (
            <Button variant="outline" className="text-destructive" disabled={isPending} onClick={() => onSave([])}>
              {deactivateLabel}
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <DialogClose render={<Button variant="outline" />}>Batal</DialogClose>
            <Button disabled={isPending || selected.length === 0} onClick={() => onSave(selected)}>
              {isPending ? "Menyimpan..." : saveLabel}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Tombol kolom "Update Mandiri" per pegawai.
export function EmployeeSelfUpdateButton({
  employeeId,
  employeeName,
  enabled,
  groups,
}: {
  employeeId: number
  employeeName: string
  enabled: boolean
  groups: unknown
}) {
  const current = parseSelfUpdateGroups(groups)
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  function save(groupsToSave: SelfUpdateGroupKey[]) {
    startTransition(async () => {
      try {
        await setEmployeeSelfUpdateAction(employeeId, groupsToSave)
        toast.success(
          groupsToSave.length
            ? `Update mandiri ${enabled ? "diperbarui" : "diaktifkan"} untuk ${employeeName}.`
            : `Update mandiri ${employeeName} dinonaktifkan.`
        )
        setOpen(false)
      } catch {
        toast.error("Gagal mengubah izin update mandiri.")
      }
    })
  }

  return (
    <>
      <Button
        variant={enabled ? "default" : "outline"}
        size="sm"
        onClick={() => setOpen(true)}
        title={enabled ? `Dibuka: ${SELF_UPDATE_GROUPS.filter((g) => current.includes(g.key)).map((g) => g.label).join(", ")}` : undefined}
      >
        {enabled ? `Aktif (${current.length})` : "Aktifkan"}
      </Button>
      {open ? (
        <SelfUpdateGroupsDialog
          open
          onOpenChange={setOpen}
          title={`Update Mandiri — ${employeeName}`}
          initial={enabled && current.length ? current : DEFAULT_SELF_UPDATE_GROUPS}
          isPending={isPending}
          saveLabel={enabled ? "Simpan" : "Aktifkan"}
          deactivateLabel={enabled ? "Nonaktifkan" : null}
          onSave={save}
        />
      ) : null}
    </>
  )
}

// Tombol batch di atas tabel — berlaku untuk pegawai yang dicentang.
export function EmployeeSelfUpdateBatchButton({
  employeeIds,
  onDone,
}: {
  employeeIds: number[]
  onDone: () => void
}) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const count = employeeIds.length

  function save(groupsToSave: SelfUpdateGroupKey[]) {
    startTransition(async () => {
      try {
        const result = await setEmployeesSelfUpdateBatchAction(employeeIds, groupsToSave)
        toast.success(
          groupsToSave.length
            ? `Update mandiri diaktifkan untuk ${result.count} pegawai. Mereka mendapat notifikasi.`
            : `Update mandiri dinonaktifkan untuk ${result.count} pegawai.`
        )
        setOpen(false)
        onDone()
      } catch {
        toast.error("Gagal mengubah izin update mandiri.")
      }
    })
  }

  return (
    <>
      <Button variant="outline" disabled={count === 0} onClick={() => setOpen(true)}>
        <UserPen className="size-4" />
        Update Mandiri{count ? ` (${count} dipilih)` : ""}
      </Button>
      {open ? (
        <SelfUpdateGroupsDialog
          open
          onOpenChange={setOpen}
          title={`Update Mandiri — ${count} pegawai`}
          initial={DEFAULT_SELF_UPDATE_GROUPS}
          isPending={isPending}
          saveLabel={`Aktifkan untuk ${count} pegawai`}
          deactivateLabel={`Nonaktifkan untuk ${count} pegawai`}
          onSave={save}
        />
      ) : null}
    </>
  )
}
