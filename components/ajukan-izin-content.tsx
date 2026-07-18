"use client"

import Link from "next/link"
import { toast } from "sonner"
import { ChevronRight } from "lucide-react"

import { LEAVE_TYPES, type LeaveTypeOption } from "@/lib/leave-types"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

export function AjukanIzinContent() {
  function handleSelect(type: LeaveTypeOption) {
    toast.info(`Form pengajuan "${type.label}" akan segera aktif.`)
  }

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold">Ajukan Izin</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Pilih jenis izin dan isi formulir yang sesuai. Pengajuan akan masuk ke
        antrian approval.
      </p>

      <Card>
        <CardHeader>
          <CardTitle>Pilih Jenis Izin</CardTitle>
          <CardDescription>
            Pilih salah satu jenis izin di bawah untuk melanjutkan.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {LEAVE_TYPES.map((type) => {
            const Icon = type.icon
            const cardInner = (
              <>
                <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Icon className="size-4.5" />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold">{type.label}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {type.description}
                  </span>
                </span>
                <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground" />
              </>
            )
            const className =
              "flex items-start gap-3 rounded-lg border p-4 text-left transition-colors hover:border-primary hover:bg-primary/5"

            return type.href ? (
              <Link key={type.value} href={type.href} className={className}>
                {cardInner}
              </Link>
            ) : (
              <button
                key={type.value}
                type="button"
                onClick={() => handleSelect(type)}
                className={className}
              >
                {cardInner}
              </button>
            )
          })}
        </CardContent>
      </Card>
    </div>
  )
}
