import type { HealthClaimMemoStepType } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import { DEFAULT_MEMO_CLOSING, DEFAULT_MEMO_OPENING } from "@/lib/health-claim-labels"
import { formatRupiahLetter, terbilang } from "@/lib/terbilang"

// Logika Nota Dinas klaim kesehatan — docs/prd-klaim-kesehatan.md 5.3–5.4.

type Db = Pick<typeof prisma, "healthClaim" | "healthClaimMemo">

export async function getMemoSettings() {
  const s = await prisma.healthClaimSettings.findUnique({ where: { id: 1 } })
  return {
    minEmployeesPerMemo: s?.minEmployeesPerMemo ?? 5,
    memoTo: s?.memoTo ?? "Yth. Direksi Perumda BPR Bank Gresik",
    memoFrom: s?.memoFrom ?? "Kepala Bagian Personalia, Umum & IT",
    memoSubject: s?.memoSubject ?? "PENGAJUAN BIAYA PENGGANTIAN PENGOBATAN PEGAWAI & KELUARGA",
    memoOpening: s?.memoOpening ?? DEFAULT_MEMO_OPENING,
    memoClosing: s?.memoClosing ?? DEFAULT_MEMO_CLOSING,
    memoLetterNumberFormat: s?.memoLetterNumberFormat ?? null,
  }
}

// Teks pembuka dengan placeholder {total} & {terbilang} diisi.
export function renderMemoOpening(template: string, total: number) {
  return template.replaceAll("{total}", formatRupiahLetter(total)).replaceAll("{terbilang}", terbilang(total))
}

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"]

export function buildLetterNumber(format: string | null, seq: number, date: Date) {
  if (!format?.trim()) return null
  const month = date.getUTCMonth()
  return format
    .replaceAll("{no}", String(seq).padStart(3, "0"))
    .replaceAll("{bulan_romawi}", ROMAN[month])
    .replaceAll("{bulan}", String(month + 1).padStart(2, "0"))
    .replaceAll("{tahun}", String(date.getUTCFullYear()))
}

// Nomor internal berurut per tahun: ND-KES-2026-001. Urutan yang sama dipakai
// untuk {no} pada nomor surat.
export async function nextMemoSequence(tx: Db, year: number) {
  const prefix = `ND-KES-${year}-`
  const last = await tx.healthClaimMemo.findFirst({
    where: { memoNumber: { startsWith: prefix } },
    orderBy: { memoNumber: "desc" },
    select: { memoNumber: true },
  })
  const seq = last ? Number(last.memoNumber.slice(prefix.length)) + 1 : 1
  return { seq, memoNumber: `${prefix}${String(seq).padStart(3, "0")}` }
}

export type MemoDraftRow = {
  claimId: number
  claimPublicId: string
  claimNumber: string
  employeeId: number
  employeeName: string
  employeeNumber: string
  patientName: string
  patientLabel: string
  claimTypeName: string
  treatmentDate: Date
  plafonYear: number
  amount: number
  balanceBefore: number
  defaultNote: string
}

// Baris tabel Nota Dinas untuk klaim-klaim terpilih. "Saldo Awal" = plafon
// dikurangi klaim yang sudah disetujui/dibayar atau sudah berada di Nota
// Dinas lain; bila seorang pegawai punya beberapa klaim di Nota Dinas yang
// sama, saldo baris berikutnya sudah dikurangi baris sebelumnya.
export async function buildMemoDraftRows(claimIds: number[], excludeMemoId?: number): Promise<MemoDraftRow[]> {
  const claims = await prisma.healthClaim.findMany({
    where: { id: { in: claimIds } },
    include: {
      claimType: { select: { name: true } },
      employee: {
        select: {
          fullName: true,
          employeeNumber: true,
          position: { select: { healthClaimPlafon: { select: { amount: true } } } },
        },
      },
    },
    orderBy: [{ employee: { fullName: "asc" } }, { submittedAt: "asc" }],
  })

  const running = new Map<string, number>()
  const rows: MemoDraftRow[] = []
  for (const c of claims) {
    const key = `${c.employeeId}:${c.plafonYear}`
    if (!running.has(key)) {
      const plafon = c.employee.position.healthClaimPlafon?.amount ?? 0
      const taken = await prisma.healthClaim.findMany({
        where: {
          employeeId: c.employeeId,
          plafonYear: c.plafonYear,
          id: { notIn: claimIds },
          status: { in: ["DISETUJUI", "DIBAYAR", "DALAM_NOTA_DINAS"] },
          ...(excludeMemoId ? { NOT: { memoItems: { some: { memoId: excludeMemoId } } } } : {}),
        },
        select: { approvedAmount: true, requestedAmount: true },
      })
      running.set(key, plafon - taken.reduce((s, t) => s + (t.approvedAmount ?? t.requestedAmount), 0))
    }
    const balanceBefore = running.get(key)!
    const amount = c.approvedAmount ?? c.requestedAmount
    running.set(key, balanceBefore - amount)
    rows.push({
      claimId: c.id,
      claimPublicId: c.publicId,
      claimNumber: c.claimNumber,
      employeeId: c.employeeId,
      employeeName: c.employee.fullName,
      employeeNumber: c.employee.employeeNumber,
      patientName: c.patientName,
      patientLabel: c.patientType === "CHILD" ? `${c.patientName} (Anak)` : c.patientType === "SPOUSE" ? `${c.patientName} (Pasangan)` : c.patientName,
      claimTypeName: c.claimType.name,
      treatmentDate: c.treatmentDate,
      plafonYear: c.plafonYear,
      amount,
      balanceBefore: Math.max(0, balanceBefore),
      defaultNote: c.claimType.name,
    })
  }
  return rows
}

export type ResolvedStep = {
  order: number
  type: HealthClaimMemoStepType
  label: string
  approverEmployeeId: number | null
  canAdjust: boolean
  skipped: boolean
}

// Menerjemahkan konfigurasi alur menjadi langkah nyata untuk pembuat ini.
// Langkah dilewati bila penyetujunya tidak bisa ditentukan atau adalah
// pembuat Nota Dinas sendiri (sama seperti Alur Approval Izin).
export async function resolveMemoSteps(creatorEmployeeId: number): Promise<ResolvedStep[]> {
  const [flow, creator] = await Promise.all([
    prisma.healthClaimMemoFlowStep.findMany({ orderBy: { order: "asc" } }),
    prisma.employee.findUnique({
      where: { id: creatorEmployeeId },
      select: { reportsToId: true, department: { select: { headEmployeeId: true } } },
    }),
  ])
  return flow.map((f, i) => {
    let approver: number | null = null
    if (f.type === "ATASAN_LANGSUNG") approver = creator?.reportsToId ?? null
    else if (f.type === "KEPALA_DEPARTEMEN") approver = creator?.department.headEmployeeId ?? null
    else approver = f.approverEmployeeId
    const skipped = approver === null || approver === creatorEmployeeId
    return {
      order: i + 1,
      type: f.type,
      label: f.label,
      approverEmployeeId: skipped ? null : approver,
      canAdjust: f.canAdjust,
      skipped,
    }
  })
}

// Siapa yang boleh membuka Nota Dinas: pembuat/petugas klaim, penyetuju di
// salah satu langkahnya, Accounting, Super Admin, dan HR Admin dengan akses
// menu Klaim Kesehatan.
export async function canViewMemo(
  user: { role: string; employeeId?: number | null; menuAccess?: string[] },
  memoId: number
) {
  if (user.role === "SUPER_ADMIN") return true
  if (user.role === "HR_ADMIN" && user.menuAccess?.includes("payroll.klaim-kesehatan")) return true
  if (!user.employeeId) return false
  const staff = await prisma.healthClaimStaff.findFirst({ where: { employeeId: user.employeeId }, select: { id: true } })
  if (staff) return true
  const step = await prisma.healthClaimMemoStep.findFirst({
    where: { memoId, approverEmployeeId: user.employeeId },
    select: { id: true },
  })
  return Boolean(step)
}

export async function countPendingMemoSteps(employeeId: number | null | undefined) {
  if (!employeeId) return 0
  return prisma.healthClaimMemoStep.count({
    where: { approverEmployeeId: employeeId, status: "AKTIF", memo: { status: "MENUNGGU_PERSETUJUAN" } },
  })
}

export type MemoHistoryEntry = {
  at: Date
  actor: string
  title: string
  detail: string | null
  tone: "neutral" | "success" | "warning" | "danger"
}

const DISPOSITION_TEXT: Record<string, string> = {
  SETUJU: "Setuju, proses pembayaran",
  SETUJU_CATATAN: "Setuju dengan catatan",
  TINJAU_ULANG: "Tinjau ulang",
  TIDAK_SETUJU: "Tidak disetujui",
}

// Riwayat lengkap satu Nota Dinas, disusun dari data yang sudah tercatat:
// langkah persetujuan, perubahan isi (nominal diturunkan / klaim dikeluarkan,
// tercatat di riwayat klaim), pengajuan ulang, pembatalan, dan pembayaran.
export async function getMemoHistory(memoId: number): Promise<MemoHistoryEntry[]> {
  const memo = await prisma.healthClaimMemo.findUnique({
    where: { id: memoId },
    include: {
      createdBy: { select: { fullName: true } },
      items: { select: { claimId: true } },
      steps: { orderBy: [{ round: "asc" }, { order: "asc" }] },
      payments: {
        include: { claim: { select: { claimNumber: true, employee: { select: { fullName: true } } } } },
      },
    },
  })
  if (!memo) return []

  const entries: MemoHistoryEntry[] = [
    {
      at: memo.createdAt,
      actor: memo.createdBy.fullName,
      title: "Nota Dinas dibuat dan diajukan",
      detail: memo.forcedReason ? `Dibuat dengan klaim kurang dari minimal: ${memo.forcedReason}` : null,
      tone: "neutral",
    },
  ]

  // Pengajuan ulang: putaran ke-2 dst. dimulai saat langkahnya dibuat.
  const rounds = [...new Set(memo.steps.map((s) => s.round))].filter((r) => r > 1)
  for (const r of rounds) {
    const first = memo.steps.find((s) => s.round === r)
    if (first) {
      entries.push({
        at: first.createdAt,
        actor: memo.createdBy.fullName,
        title: `Diajukan ulang (pengajuan ke-${r})`,
        detail: null,
        tone: "neutral",
      })
    }
  }

  for (const s of memo.steps) {
    if (!s.actedAt) continue
    const actor = s.actorName ?? s.label
    if (s.status === "DISETUJUI") {
      entries.push({
        at: s.actedAt,
        actor,
        title: s.decision ? `Disposisi: ${DISPOSITION_TEXT[s.decision]}` : `Disetujui sebagai ${s.label}`,
        detail: s.note,
        tone: "success",
      })
    } else if (s.status === "DIKEMBALIKAN") {
      entries.push({
        at: s.actedAt,
        actor,
        title: s.decision ? "Disposisi: Tinjau ulang" : `Dikembalikan oleh ${s.label}`,
        detail: s.note,
        tone: "warning",
      })
    } else if (s.status === "DITOLAK") {
      entries.push({ at: s.actedAt, actor, title: "Disposisi: Tidak disetujui", detail: s.note, tone: "danger" })
    }
  }

  // Perubahan isi oleh penyetuju/petugas, dari riwayat klaim. Klaim yang
  // dikeluarkan sudah tidak terhubung ke item, jadi dicari lewat nomor Nota Dinas.
  const claimEvents = await prisma.healthClaimEvent.findMany({
    where: {
      createdAt: { gte: memo.createdAt },
      OR: [
        { action: "KELUAR_NOTA_DINAS", note: { contains: memo.memoNumber } },
        { action: "NOMINAL_DIUBAH", note: { contains: memo.memoNumber } },
        // Catatan lama (sebelum nomor Nota Dinas disertakan di catatan).
        { action: "NOMINAL_DIUBAH", claimId: { in: memo.items.map((i) => i.claimId) } },
      ],
    },
    include: { claim: { select: { claimNumber: true, employee: { select: { fullName: true } } } } },
    orderBy: { createdAt: "asc" },
  })
  const seen = new Set<string>()
  for (const e of claimEvents) {
    const who = `${e.claim.claimNumber} (${e.claim.employee.fullName})`
    if (e.action === "NOMINAL_DIUBAH") {
      entries.push({
        at: e.createdAt,
        actor: e.actorName,
        title: `Nominal ${who} diturunkan`,
        detail: e.note?.replace(` di Nota Dinas ${memo.memoNumber}`, "") ?? null,
        tone: "warning",
      })
      continue
    }
    // Pembatalan Nota Dinas mencatat satu event per klaim — cukup ditampilkan sekali.
    if (e.note?.includes("dibatalkan")) {
      const key = `${e.actorName}|${e.note}|${Math.floor(e.createdAt.getTime() / 60_000)}`
      if (seen.has(key)) continue
      seen.add(key)
      entries.push({
        at: e.createdAt,
        actor: e.actorName,
        title: "Nota Dinas dibatalkan",
        detail: e.note.split(": ").slice(1).join(": ") || null,
        tone: "danger",
      })
      continue
    }
    entries.push({
      at: e.createdAt,
      actor: e.actorName,
      title: `${who} dikeluarkan dari Nota Dinas`,
      detail: e.note?.split(": ").slice(1).join(": ") || null,
      tone: "warning",
    })
  }

  for (const p of memo.payments) {
    entries.push({
      at: p.createdAt,
      actor: p.recordedByName,
      title: `Pembayaran ${p.claim.claimNumber} (${p.claim.employee.fullName}) dicatat`,
      detail: `${p.method === "TRANSFER" ? "Transfer" : "Tunai lewat teller"} · Rp ${p.amount.toLocaleString("id-ID")}${
        p.reference ? ` · jurnal CBS ${p.reference}` : ""
      }`,
      tone: "success",
    })
  }

  return entries.sort((a, b) => a.at.getTime() - b.at.getTime())
}
