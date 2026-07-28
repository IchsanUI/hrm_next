"use client"

import { useTransition, type FormEvent } from "react"
import { toast } from "sonner"

import { updatePph21MethodAction } from "@/server/actions/payroll-tax"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PPH21_METHODS, PPH21_METHOD_LABEL } from "@/lib/validations/payroll-tax"

const METHOD_OPTION_LABEL: Record<(typeof PPH21_METHODS)[number], string> = {
  GROSS: "Gross",
  GROSS_UP: "Gross-Up",
  NET: "Net",
  TER: "TER",
}

export function Pph21MethodForm({ method }: { method: (typeof PPH21_METHODS)[number] }) {
  const [isPending, startTransition] = useTransition()

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    startTransition(async () => {
      const result = await updatePph21MethodAction(undefined, formData)
      if (result?.error) {
        toast.error(result.error)
      } else {
        toast.success("Metode perhitungan PPh 21 berhasil disimpan.")
      }
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Metode Perhitungan PPh 21</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="pph21Method">Metode</Label>
            <select
              id="pph21Method"
              name="pph21Method"
              defaultValue={method}
              className="h-9 rounded-lg border border-input bg-transparent px-3 text-sm dark:bg-input/30"
            >
              {PPH21_METHODS.map((m) => (
                <option key={m} value={m}>
                  {METHOD_OPTION_LABEL[m]}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">{PPH21_METHOD_LABEL[method]}</p>
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
