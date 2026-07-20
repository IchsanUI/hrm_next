"use client"

import { Check, X } from "lucide-react"

import { passwordRules } from "@/lib/validations/account"
import { cn } from "@/lib/utils"

const PASSWORD_CHECKLIST: { label: string; test: (value: string) => boolean }[] = [
  { label: `Minimal ${passwordRules.minLength} karakter`, test: (v) => v.length >= passwordRules.minLength },
  { label: "Mengandung huruf besar (A-Z)", test: (v) => passwordRules.hasUpper.test(v) },
  { label: "Mengandung huruf kecil (a-z)", test: (v) => passwordRules.hasLower.test(v) },
  { label: "Mengandung angka (0-9)", test: (v) => passwordRules.hasNumber.test(v) },
  { label: "Mengandung karakter spesial (!@#$dst)", test: (v) => passwordRules.hasSpecial.test(v) },
]

export function PasswordChecklist({ value }: { value: string }) {
  return (
    <ul className="grid gap-1 text-xs">
      {PASSWORD_CHECKLIST.map((rule) => {
        const passed = rule.test(value)
        return (
          <li
            key={rule.label}
            className={cn(
              "flex items-center gap-1.5",
              passed ? "text-emerald-600" : "text-muted-foreground"
            )}
          >
            {passed ? <Check className="size-3.5" /> : <X className="size-3.5" />}
            {rule.label}
          </li>
        )
      })}
    </ul>
  )
}
