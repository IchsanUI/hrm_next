"use client"

import { useTransition, type FormEvent } from "react"
import { toast } from "sonner"

import { updateBpjsSettingsAction } from "@/server/actions/payroll-tax"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export type BpjsSettings = {
  kesehatanEmployeePercent: number
  kesehatanCompanyPercent: number
  kesehatanSalaryCap: number | null
  jhtEmployeePercent: number
  jhtCompanyPercent: number
  jpEmployeePercent: number
  jpCompanyPercent: number
  jpSalaryCap: number | null
  jkkCompanyPercent: number
  jkmCompanyPercent: number
}

function PercentField({
  name,
  label,
  defaultValue,
}: {
  name: string
  label: string
  defaultValue: number
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type="number" step="any" min="0" defaultValue={defaultValue} />
    </div>
  )
}

export function BpjsSettingsForm({ settings }: { settings: BpjsSettings }) {
  const [isPending, startTransition] = useTransition()

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    startTransition(async () => {
      const result = await updateBpjsSettingsAction(undefined, formData)
      if (result?.error) {
        toast.error(result.error)
      } else {
        toast.success("Pengaturan rate BPJS berhasil disimpan.")
      }
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Rate Iuran BPJS</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div>
            <p className="mb-2 text-sm font-medium">BPJS Kesehatan</p>
            <div className="grid gap-4 sm:grid-cols-3">
              <PercentField
                name="kesehatanEmployeePercent"
                label="Ditanggung Pegawai (%)"
                defaultValue={settings.kesehatanEmployeePercent}
              />
              <PercentField
                name="kesehatanCompanyPercent"
                label="Ditanggung Perusahaan (%)"
                defaultValue={settings.kesehatanCompanyPercent}
              />
              <div className="grid gap-2">
                <Label htmlFor="kesehatanSalaryCap">Batas Atas Gaji (Rp)</Label>
                <Input
                  id="kesehatanSalaryCap"
                  name="kesehatanSalaryCap"
                  type="number"
                  min="0"
                  placeholder="opsional"
                  defaultValue={settings.kesehatanSalaryCap ?? ""}
                />
              </div>
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium">JHT (Jaminan Hari Tua)</p>
            <div className="grid gap-4 sm:grid-cols-3">
              <PercentField
                name="jhtEmployeePercent"
                label="Ditanggung Pegawai (%)"
                defaultValue={settings.jhtEmployeePercent}
              />
              <PercentField
                name="jhtCompanyPercent"
                label="Ditanggung Perusahaan (%)"
                defaultValue={settings.jhtCompanyPercent}
              />
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium">JP (Jaminan Pensiun)</p>
            <div className="grid gap-4 sm:grid-cols-3">
              <PercentField
                name="jpEmployeePercent"
                label="Ditanggung Pegawai (%)"
                defaultValue={settings.jpEmployeePercent}
              />
              <PercentField
                name="jpCompanyPercent"
                label="Ditanggung Perusahaan (%)"
                defaultValue={settings.jpCompanyPercent}
              />
              <div className="grid gap-2">
                <Label htmlFor="jpSalaryCap">Batas Atas Gaji (Rp)</Label>
                <Input
                  id="jpSalaryCap"
                  name="jpSalaryCap"
                  type="number"
                  min="0"
                  placeholder="opsional"
                  defaultValue={settings.jpSalaryCap ?? ""}
                />
              </div>
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium">JKK & JKM (ditanggung penuh perusahaan)</p>
            <div className="grid gap-4 sm:grid-cols-3">
              <PercentField
                name="jkkCompanyPercent"
                label="JKK (%)"
                defaultValue={settings.jkkCompanyPercent}
              />
              <PercentField
                name="jkmCompanyPercent"
                label="JKM (%)"
                defaultValue={settings.jkmCompanyPercent}
              />
            </div>
          </div>

          <div>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Menyimpan..." : "Simpan"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
