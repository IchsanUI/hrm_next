"use client"

import { useEffect, useState } from "react"
import { Download, Smartphone, Monitor, Apple } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger, TabsPanel } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

// Event non-standar Chromium (`beforeinstallprompt`) — belum ada di lib.dom.d.ts
// bawaan TypeScript, jadi diketik manual di sini.
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

function OrderedSteps({ steps }: { steps: string[] }) {
  return (
    <ol className="grid gap-2 text-sm">
      {steps.map((step, i) => (
        <li key={i} className="flex gap-2.5">
          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
            {i + 1}
          </span>
          <span className="pt-0.5">{step}</span>
        </li>
      ))}
    </ol>
  )
}

// Guide instalasi PWA per platform — Android/Desktop Chromium punya prompt
// native (beforeinstallprompt, ditangani tombol "Install Sekarang" di
// bawah), sementara iOS Safari TIDAK PERNAH mendukung itu (pembatasan Apple)
// jadi langkahnya murni manual lewat menu Share.
export function PwaInstallGuide() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isInstalled, setIsInstalled] = useState(false)

  useEffect(() => {
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true)
    }

    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault()
      setDeferredPrompt(event as BeforeInstallPromptEvent)
    }
    function handleAppInstalled() {
      setIsInstalled(true)
      setDeferredPrompt(null)
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
    window.addEventListener("appinstalled", handleAppInstalled)
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
      window.removeEventListener("appinstalled", handleAppInstalled)
    }
  }, [])

  async function handleInstallClick() {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    await deferredPrompt.userChoice
    setDeferredPrompt(null)
  }

  return (
    <Card id="pwa-install">
      <CardHeader>
        <CardTitle>Install Aplikasi (PWA)</CardTitle>
        <CardDescription>
          Pasang HRIS di perangkat Anda supaya bisa dibuka seperti aplikasi biasa (ikon di
          layar utama, tanpa bar alamat browser) lebih cepat diakses, terutama untuk
          absen/ajukan izin dari HP.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {isInstalled ? (
          <p className="text-sm text-muted-foreground">
            Aplikasi ini sudah terpasang di perangkat Anda. 🎉
          </p>
        ) : deferredPrompt ? (
          <div>
            <Button onClick={handleInstallClick}>
              <Download className="size-4" />
              Install Sekarang
            </Button>
            <p className="mt-2 text-xs text-muted-foreground">
              Browser Anda mendukung install satu klik atau ikuti panduan manual di bawah
              kalau tombol ini tidak muncul lagi nanti.
            </p>
          </div>
        ) : null}

        <Tabs defaultValue="android">
          <TabsList>
            <TabsTrigger value="android">
              <Smartphone className="size-3.5" />
              Android
            </TabsTrigger>
            <TabsTrigger value="ios">
              <Apple className="size-3.5" />
              iPhone/iPad
            </TabsTrigger>
            <TabsTrigger value="desktop">
              <Monitor className="size-3.5" />
              Laptop/Komputer
            </TabsTrigger>
          </TabsList>

          <TabsPanel value="android">
            <OrderedSteps
              steps={[
                "Buka situs ini di Chrome.",
                'Ketuk ikon titik tiga (⋮) di pojok kanan atas.',
                'Pilih "Install app" atau "Tambahkan ke layar Utama".',
                'Ketuk "Install" pada konfirmasi yang muncul.',
              ]}
            />
          </TabsPanel>

          <TabsPanel value="ios">
            <OrderedSteps
              steps={[
                "Buka situs ini di Safari (wajib Safari — browser lain di iOS tidak bisa install PWA).",
                'Ketuk ikon Share (kotak dengan panah ke atas) di bar bawah.',
                'Scroll lalu pilih "Add to Home Screen" / "Tambah ke Layar Utama".',
                'Ketuk "Add" di pojok kanan atas.',
              ]}
            />
          </TabsPanel>

          <TabsPanel value="desktop">
            <OrderedSteps
              steps={[
                "Buka situs ini di Chrome atau Edge.",
                "Klik ikon install (gambar layar dengan panah ⊕) di ujung kanan bar alamat.",
                'Kalau ikon itu tidak terlihat, klik menu titik tiga (⋮) → "Install HRIS...".',
                'Klik "Install" pada konfirmasi yang muncul.',
              ]}
            />
          </TabsPanel>
        </Tabs>
      </CardContent>
    </Card>
  )
}
