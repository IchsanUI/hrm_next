"use client"

import { useActionState, useEffect, useState, useTransition } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { FileSpreadsheet, Gauge, MapPin, Pencil, Plus, Trash2, Users, X } from "lucide-react"
import { toast } from "sonner"

import { deleteVehicleAction, saveVehicleAction, setVehicleStaffAction, type VehicleFormState } from "@/server/actions/vehicles"
import { VehicleThumb } from "@/components/vehicle/booking-dialog"
import { DataTable } from "@/components/data-table"
import { ReportMonthDialog, type SuratReportOption } from "@/components/report-month-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  BOOKING_STATUS_CLASS,
  BOOKING_STATUS_LABEL,
  VEHICLE_STATUS_LABEL,
  type VehicleBookingStatusValue,
  type VehicleStatusValue,
} from "@/lib/vehicle-booking-labels"
import { cn } from "@/lib/utils"

export type AdminVehicle = {
  publicId: string
  name: string
  plateNumber: string
  capacity: number
  color: string | null
  photoUrl: string | null
  workLocationId: number
  workLocationName: string
  status: VehicleStatusValue
  notes: string | null
  lastOdometerKm: number | null
  bookingCount: number
}

const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-2.5 text-sm shadow-xs outline-none focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"

const STATUS_DOT: Record<VehicleStatusValue, string> = {
  TERSEDIA: "bg-emerald-500",
  SERVIS: "bg-amber-500",
  NONAKTIF: "bg-muted-foreground",
}

export function VehicleManager({ vehicles, locations }: { vehicles: AdminVehicle[]; locations: { id: number; name: string }[] }) {
  const [editing, setEditing] = useState<AdminVehicle | "new" | null>(null)
  const [isDeleting, startDeleting] = useTransition()

  return (
    <div className="grid gap-4">
      <div className="flex justify-end">
        <Button onClick={() => setEditing("new")}>
          <Plus /> Tambah Kendaraan
        </Button>
      </div>
      {vehicles.length ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {vehicles.map((v) => (
            <article key={v.publicId} className="overflow-hidden rounded-2xl border bg-card">
              <VehicleThumb photoUrl={v.photoUrl} className="aspect-[16/9] w-full" />
              <div className="grid gap-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{v.name}</p>
                    <p className="font-mono text-xs text-muted-foreground">{v.plateNumber}</p>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px]">
                    <span className={cn("size-1.5 rounded-full", STATUS_DOT[v.status])} />
                    {VEHICLE_STATUS_LABEL[v.status]}
                  </span>
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="size-3.5" /> {v.workLocationName}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Users className="size-3.5" /> {v.capacity} kursi
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Gauge className="size-3.5" /> {v.lastOdometerKm !== null ? `${v.lastOdometerKm.toLocaleString("id-ID")} km` : "KM belum tercatat"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{v.bookingCount} kali dibooking</p>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => setEditing(v)}>
                    <Pencil /> Ubah
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    disabled={isDeleting}
                    aria-label={`Hapus ${v.name}`}
                    onClick={() =>
                      startDeleting(async () => {
                        if (!window.confirm(`Hapus ${v.name} (${v.plateNumber})?`)) return
                        const result = await deleteVehicleAction(v.publicId)
                        if (result?.error) toast.error(result.error)
                        else toast.success("Kendaraan dihapus.")
                      })
                    }
                  >
                    <Trash2 />
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          Belum ada kendaraan. Tambahkan mobil kantor beserta lokasinya.
        </p>
      )}

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-w-[calc(100%-1rem)] sm:max-w-lg">
          {editing ? (
            <VehicleForm
              key={editing === "new" ? "new" : editing.publicId}
              vehicle={editing === "new" ? null : editing}
              locations={locations}
              onDone={() => setEditing(null)}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function VehicleForm({
  vehicle,
  locations,
  onDone,
}: {
  vehicle: AdminVehicle | null
  locations: { id: number; name: string }[]
  onDone: () => void
}) {
  const [state, formAction, isPending] = useActionState<VehicleFormState, FormData>(saveVehicleAction, undefined)
  useEffect(() => {
    if (state?.error) toast.error(state.error)
    if (state?.success) {
      toast.success("Kendaraan disimpan.")
      onDone()
    }
  }, [state, onDone])

  return (
    <form action={formAction} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{vehicle ? "Ubah Kendaraan" : "Tambah Kendaraan"}</DialogTitle>
        <DialogDescription>Mobil hanya bisa dibooking pegawai di lokasi kerja yang sama.</DialogDescription>
      </DialogHeader>
      {vehicle ? <input type="hidden" name="publicId" value={vehicle.publicId} /> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5 sm:col-span-2">
          <Label htmlFor="v-name">Nama / tipe</Label>
          <Input id="v-name" name="name" defaultValue={vehicle?.name} placeholder="Toyota Avanza" required />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="v-plate">Plat nomor</Label>
          <Input id="v-plate" name="plateNumber" defaultValue={vehicle?.plateNumber} placeholder="W 1234 AB" required />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="v-capacity">Kapasitas (kursi)</Label>
          <Input id="v-capacity" name="capacity" type="number" min={2} max={60} defaultValue={vehicle?.capacity ?? 7} required />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="v-color">Warna</Label>
          <Input id="v-color" name="color" defaultValue={vehicle?.color ?? ""} placeholder="Putih" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="v-status">Status</Label>
          <select id="v-status" name="status" defaultValue={vehicle?.status ?? "TERSEDIA"} className={selectClass}>
            {(Object.keys(VEHICLE_STATUS_LABEL) as VehicleStatusValue[]).map((s) => (
              <option key={s} value={s}>
                {VEHICLE_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1.5 sm:col-span-2">
          <Label htmlFor="v-location">Lokasi kerja</Label>
          <select id="v-location" name="workLocationId" defaultValue={vehicle?.workLocationId ?? locations[0]?.id} className={selectClass} required>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1.5 sm:col-span-2">
          <Label htmlFor="v-photo">Foto {vehicle?.photoUrl ? "(kosongkan kalau tidak diganti)" : "(opsional)"}</Label>
          <Input id="v-photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp" />
        </div>
        <div className="grid gap-1.5 sm:col-span-2">
          <Label htmlFor="v-notes">Catatan</Label>
          <Textarea id="v-notes" name="notes" defaultValue={vehicle?.notes ?? ""} rows={2} />
        </div>
      </div>
      <DialogFooter>
        <Button type="submit" disabled={isPending} className="w-full sm:w-auto">
          {isPending ? "Menyimpan…" : "Simpan"}
        </Button>
      </DialogFooter>
    </form>
  )
}

export function VehicleStaffManager({
  staff,
  employees,
}: {
  staff: { employeeId: number; fullName: string; position: string; role: "PETUGAS" | "SOPIR" }[]
  employees: { id: number; label: string }[]
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <StaffColumn
        role="PETUGAS"
        title="Petugas Umum"
        description="Menyetujui booking, menugaskan sopir, dan mencatat serah-terima kunci. Mendapat notifikasi setiap ada booking baru."
        staff={staff.filter((s) => s.role === "PETUGAS")}
        employees={employees}
      />
      <StaffColumn
        role="SOPIR"
        title="Sopir"
        description="Bisa ditugaskan petugas saat pemohon meminta sopir. Sistem mencegah sopir bertugas di dua jadwal yang bentrok."
        staff={staff.filter((s) => s.role === "SOPIR")}
        employees={employees}
      />
    </div>
  )
}

function StaffColumn({
  role,
  title,
  description,
  staff,
  employees,
}: {
  role: "PETUGAS" | "SOPIR"
  title: string
  description: string
  staff: { employeeId: number; fullName: string; position: string }[]
  employees: { id: number; label: string }[]
}) {
  const [selected, setSelected] = useState("")
  const [isPending, startTransition] = useTransition()
  const available = employees.filter((e) => !staff.some((s) => s.employeeId === e.id))

  function update(employeeId: number, enabled: boolean) {
    startTransition(async () => {
      const result = await setVehicleStaffAction(employeeId, role, enabled)
      if (result?.error) toast.error(result.error)
      else {
        toast.success(enabled ? `${title} ditambahkan.` : `${title} dicabut.`)
        setSelected("")
      }
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="flex gap-2">
          <select value={selected} onChange={(e) => setSelected(e.target.value)} className={selectClass} aria-label={`Pilih ${title}`}>
            <option value="">Pilih pegawai…</option>
            {available.map((e) => (
              <option key={e.id} value={e.id}>
                {e.label}
              </option>
            ))}
          </select>
          <Button disabled={!selected || isPending} onClick={() => update(Number(selected), true)}>
            <Plus /> Tambah
          </Button>
        </div>
        {staff.length ? (
          <ul className="divide-y rounded-lg border">
            {staff.map((s) => (
              <li key={s.employeeId} className="flex items-center gap-2 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{s.fullName}</p>
                  <p className="truncate text-xs text-muted-foreground">{s.position}</p>
                </div>
                <Button size="icon-sm" variant="ghost" disabled={isPending} aria-label={`Cabut ${s.fullName}`} onClick={() => update(s.employeeId, false)}>
                  <X />
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Belum ada {title.toLowerCase()}.</p>
        )}
      </CardContent>
    </Card>
  )
}

export type AdminBookingRow = {
  bookingNumber: string
  requester: string
  vehicle: string
  when: string
  destination: string
  driver: string
  status: VehicleBookingStatusValue
}

const bookingColumns: ColumnDef<AdminBookingRow, unknown>[] = [
  { accessorKey: "bookingNumber", header: "No. Booking", cell: ({ row }) => <span className="font-mono text-xs">{row.original.bookingNumber}</span> },
  { accessorKey: "requester", header: "Pemohon" },
  { accessorKey: "vehicle", header: "Mobil" },
  { accessorKey: "when", header: "Waktu", cell: ({ row }) => <span className="whitespace-nowrap">{row.original.when}</span> },
  { accessorKey: "destination", header: "Tujuan" },
  { accessorKey: "driver", header: "Sopir" },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => (
      <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap", BOOKING_STATUS_CLASS[row.original.status])}>
        {BOOKING_STATUS_LABEL[row.original.status]}
      </span>
    ),
  },
]

const BOOKING_EXPORT: SuratReportOption = {
  key: "rekap-kendaraan",
  label: "Export Rekap Kendaraan Dinas",
  downloadPath: "/api/laporan/rekap-kendaraan",
  formatDescription:
    "Excel berisi tiga sheet untuk booking yang dimulai di bulan terpilih: Rincian Booking, Rekap per Mobil (jam pakai & jarak tempuh), dan Rekap per Pemohon.",
}

export function VehicleBookingsTable({ rows }: { rows: AdminBookingRow[] }) {
  const [exporting, setExporting] = useState(false)
  return (
    <>
      <DataTable
        columns={bookingColumns}
        data={rows}
        searchPlaceholder="Cari pemohon, mobil, tujuan…"
        emptyMessage="Belum ada booking."
        toolbarEnd={
          <Button variant="outline" onClick={() => setExporting(true)}>
            <FileSpreadsheet className="size-4 text-emerald-600" />
            Export Excel
          </Button>
        }
      />
      <ReportMonthDialog report={exporting ? BOOKING_EXPORT : null} onOpenChange={(open) => !open && setExporting(false)} />
    </>
  )
}
