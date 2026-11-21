import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { searchLibraryContent } from "@/lib/library-search"

// Pencarian isi dokumen Perpustakaan (GET ?q=…). Sengaja route handler, BUKAN
// server action: server action yang memperbarui cookie sesi (lastSeenAt di
// auth.config.ts) membuat Next.js me-refresh seluruh halaman, sehingga kotak
// pencarian kehilangan fokus saat pegawai sedang mengetik.
export async function GET(request: Request) {
  const session = await auth()
  const user = session?.user
  if (!user) return NextResponse.json({ error: "Sesi berakhir. Silakan masuk kembali." }, { status: 401 })

  const isManager =
    user.role === "SUPER_ADMIN" || (user.role === "HR_ADMIN" && user.menuAccess.includes("perpustakaan.kelola"))
  if (!user.employeeId && !isManager) {
    return NextResponse.json({ error: "Akun Anda tidak terhubung ke data pegawai." }, { status: 403 })
  }

  const url = new URL(request.url)
  const q = (url.searchParams.get("q") ?? "").trim()
  if (q.length < 2) return NextResponse.json({ hits: [] })
  const includeDrafts = isManager && url.searchParams.get("draf") === "1"
  const { hits } = await searchLibraryContent(q, { includeDrafts })
  return NextResponse.json({ hits }, { headers: { "Cache-Control": "no-store" } })
}
