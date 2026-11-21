"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Building2, Loader2, Pencil, Plus, Trash2, UsersRound } from "lucide-react"
import { toast } from "sonner"

import { deleteOrgExternalAction, saveOrgExternalAction, type OrgExternalInput } from "@/server/actions/org-external"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"

export type OrgExternalRow = {
  id: number
  name: string
  title: string
  organization: string | null
  parentExternalId: number | null
  parentEmployeeId: number | null
  childEmployeeIds: number[]
  sortOrder: number
}

export type OrgEmployeeOption = { id: number; label: string; hasSupervisor: boolean }

const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"

// Pihak di luar kepegawaian di bagan Struktur Organisasi (mis. Bupati).
export function OrgExternalManager({
  externals,
  employees,
}: {
  externals: OrgExternalRow[]
  employees: OrgEmployeeOption[]
}) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<OrgExternalRow | "new" | null>(null)
  const employeeName = new Map(employees.map((e) => [e.id, e.label]))
  const externalName = new Map(externals.map((x) => [x.id, x.name]))

  function positionLabel(x: OrgExternalRow) {
    if (x.parentExternalId) return `di bawah ${externalName.get(x.parentExternalId) ?? "pihak luar"}`
    if (x.parentEmployeeId) return `di bawah ${employeeName.get(x.parentEmployeeId)?.split(" — ")[0] ?? "pegawai"}`
    return "paling atas"
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <UsersRound className="size-4" />
        Kelola Pihak Luar{externals.length ? ` (${externals.length})` : ""}
      </Button>

      <Dialog open={open} onOpenChange={(v) => !v && (setOpen(false), setEditing(null))}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          {editing ? (
            <ExternalForm
              key={editing === "new" ? "new" : editing.id}
              row={editing === "new" ? null : editing}
              externals={externals}
              employees={employees}
              onDone={() => setEditing(null)}
            />
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Pihak di Luar Kepegawaian</DialogTitle>
                <DialogDescription>
                  Orang yang ikut tampil di bagan tetapi bukan pegawai, mis. Bupati selaku pemilik, Dewan Pengawas, atau
                  konsultan. Tampil dengan kotak garis putus-putus.
                </DialogDescription>
              </DialogHeader>
              {externals.length ? (
                <ul className="divide-y rounded-md border">
                  {externals.map((x) => (
                    <ExternalItem
                      key={x.id}
                      row={x}
                      position={positionLabel(x)}
                      childNames={x.childEmployeeIds.map((id) => employeeName.get(id)?.split(" — ")[0]).filter(Boolean) as string[]}
                      onEdit={() => setEditing(x)}
                    />
                  ))}
                </ul>
              ) : (
                <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                  Belum ada pihak luar. Contoh: <strong>Bupati Gresik</strong> di atas Direktur Utama.
                </p>
              )}
              <DialogFooter>
                <Button onClick={() => setEditing("new")}>
                  <Plus className="size-4" />
                  Tambah Pihak Luar
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

function ExternalItem({
  row,
  position,
  childNames,
  onEdit,
}: {
  row: OrgExternalRow
  position: string
  childNames: string[]
  onEdit: () => void
}) {
  const router = useRouter()
  const [confirm, setConfirm] = useState(false)
  const [isPending, startTransition] = useTransition()
  return (
    <li className="flex items-start gap-3 px-3 py-2.5">
      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full border border-dashed border-violet-400 bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300">
        <Building2 className="size-4" />
      </span>
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-medium">{row.name}</p>
        <p className="text-xs text-muted-foreground">
          {row.title}
          {row.organization ? ` · ${row.organization}` : ""}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Posisi: {position}
          {childNames.length ? ` · membawahi ${childNames.join(", ")}` : ""}
        </p>
      </div>
      {confirm ? (
        <div className="flex shrink-0 gap-1">
          <Button size="sm" variant="ghost" onClick={() => setConfirm(false)} disabled={isPending}>
            Batal
          </Button>
          <Button
            size="sm"
            variant="destructive"
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                const result = await deleteOrgExternalAction(row.id)
                if (result.error) return void toast.error(result.error)
                toast.success("Pihak luar dihapus dari bagan.")
                router.refresh()
              })
            }
          >
            {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            Hapus
          </Button>
        </div>
      ) : (
        <div className="flex shrink-0 gap-1">
          <Button size="icon-sm" variant="outline" onClick={onEdit} aria-label={`Ubah ${row.name}`}>
            <Pencil className="size-4" />
          </Button>
          <Button
            size="icon-sm"
            variant="outline"
            className="text-destructive hover:text-destructive"
            onClick={() => setConfirm(true)}
            aria-label={`Hapus ${row.name}`}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      )}
    </li>
  )
}

function ExternalForm({
  row,
  externals,
  employees,
  onDone,
}: {
  row: OrgExternalRow | null
  externals: OrgExternalRow[]
  employees: OrgEmployeeOption[]
  onDone: () => void
}) {
  const router = useRouter()
  const [name, setName] = useState(row?.name ?? "")
  const [title, setTitle] = useState(row?.title ?? "")
  const [organization, setOrganization] = useState(row?.organization ?? "")
  const [parent, setParent] = useState(
    row?.parentExternalId ? `x-${row.parentExternalId}` : row?.parentEmployeeId ? `e-${row.parentEmployeeId}` : "none"
  )
  const [children, setChildren] = useState<number[]>(row?.childEmployeeIds ?? [])
  const [sortOrder, setSortOrder] = useState(String(row?.sortOrder ?? 0))
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Hanya pegawai tanpa atasan internal yang bisa "dibawahi" pihak luar —
  // atasan internal selalu didahulukan di bagan.
  const rootEmployees = employees.filter((e) => !e.hasSupervisor || children.includes(e.id))

  function save() {
    setError(null)
    const [kind, idStr] = parent.split("-")
    const input: OrgExternalInput = {
      name,
      title,
      organization: organization.trim() || null,
      parentType: parent === "none" ? "none" : kind === "x" ? "external" : "employee",
      parentId: parent === "none" ? null : Number(idStr),
      childEmployeeIds: children,
      sortOrder: Math.max(0, Math.min(999, Number(sortOrder) || 0)),
    }
    startTransition(async () => {
      const result = await saveOrgExternalAction(row?.id ?? null, input)
      if (result.error) return setError(result.error)
      toast.success(row ? "Pihak luar diperbarui." : "Pihak luar ditambahkan ke bagan.")
      router.refresh()
      onDone()
    })
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{row ? "Ubah Pihak Luar" : "Tambah Pihak Luar"}</DialogTitle>
        <DialogDescription>Contoh: Nama <em>Fandi Akhmad Yani</em>, Jabatan <em>Bupati Gresik</em>, Instansi <em>KPM / Pemilik</em>.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="ext-name">Nama</Label>
            <Input id="ext-name" value={name} maxLength={150} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ext-title">Jabatan</Label>
            <Input id="ext-title" value={title} maxLength={150} placeholder="mis. Bupati Gresik" onChange={(e) => setTitle(e.target.value)} />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-[1fr_6rem]">
          <div className="grid gap-1.5">
            <Label htmlFor="ext-org">
              Instansi / keterangan <span className="font-normal text-muted-foreground">(opsional)</span>
            </Label>
            <Input
              id="ext-org"
              value={organization}
              maxLength={150}
              placeholder="mis. KPM / Pemilik, Dewan Pengawas"
              onChange={(e) => setOrganization(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ext-order">Urutan</Label>
            <Input id="ext-order" type="number" min={0} max={999} value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
          </div>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="ext-parent">Posisi di bagan</Label>
          <select id="ext-parent" value={parent} onChange={(e) => setParent(e.target.value)} className={selectClass}>
            <option value="none">Paling atas (tanpa induk)</option>
            {externals.filter((x) => x.id !== row?.id).length ? (
              <optgroup label="Di bawah pihak luar">
                {externals
                  .filter((x) => x.id !== row?.id)
                  .map((x) => (
                    <option key={x.id} value={`x-${x.id}`}>
                      {x.name} — {x.title}
                    </option>
                  ))}
              </optgroup>
            ) : null}
            <optgroup label="Di bawah pegawai">
              {employees.map((e) => (
                <option key={e.id} value={`e-${e.id}`}>
                  {e.label}
                </option>
              ))}
            </optgroup>
          </select>
        </div>

        <div className="grid gap-1.5">
          <Label>Membawahi pegawai</Label>
          <p className="text-xs text-muted-foreground">
            Pilih pegawai yang tampil di bawah pihak luar ini, mis. Direktur Utama di bawah Bupati. Hanya pegawai tanpa
            atasan di Data Pegawai yang bisa dipilih.
          </p>
          <div className="max-h-48 overflow-y-auto rounded-md border">
            {rootEmployees.length ? (
              rootEmployees.map((e) => (
                <label key={e.id} className="flex items-center gap-2.5 border-b px-3 py-2 text-sm last:border-b-0 hover:bg-muted/50">
                  <Checkbox
                    checked={children.includes(e.id)}
                    onCheckedChange={(v) =>
                      setChildren((list) => (v === true ? [...list, e.id] : list.filter((id) => id !== e.id)))
                    }
                  />
                  {e.label}
                </label>
              ))
            ) : (
              <p className="p-3 text-center text-xs text-muted-foreground">Semua pegawai sudah punya atasan.</p>
            )}
          </div>
        </div>

        {error ? <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onDone} disabled={isPending}>
          Kembali
        </Button>
        <Button onClick={save} disabled={isPending || name.trim().length < 2 || title.trim().length < 2}>
          {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
          Simpan
        </Button>
      </DialogFooter>
    </>
  )
}
