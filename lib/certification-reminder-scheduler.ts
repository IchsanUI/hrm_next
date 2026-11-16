import { prisma } from "@/lib/prisma"
import { createNotification, createNotificationForUsers } from "@/lib/notifications"
import { parseMenuAccess } from "@/lib/hr-menu-access"
import { daysUntil, pickLatest, startOfTodayUtc } from "@/lib/certification-status"

// Pengingat sertifikat yang akan/sudah kedaluwarsa. Pola sama dengan
// lib/backup/retention-scheduler.ts (setTimeout berantai, dinyalakan sekali
// lewat instrumentation.ts, guard globalThis agar tetap satu loop saat HMR).
//
// Tahap pengingat per sertifikat: reminderDays (bawaan 90), 30, 7, dan 0
// (hari kedaluwarsa/sesudahnya). Tiap tahap dikirim SEKALI —
// EmployeeCertification.lastReminderStage mencatat tahap terakhir.
const CHECK_INTERVAL_MS = 12 * 60 * 60 * 1000
const FIRST_RUN_DELAY_MS = 2 * 60 * 1000

declare global {
  var __certificationReminderStarted: boolean | undefined
}

let isRunning = false

function stagesFor(reminderDays: number) {
  return [...new Set([reminderDays, 30, 7, 0])].filter((s) => s <= reminderDays).sort((a, b) => b - a)
}

// Tahap paling mendesak yang sudah tercapai; null = belum masuk masa pengingat.
export function reachedStage(daysLeft: number, reminderDays: number): number | null {
  const reached = stagesFor(reminderDays).filter((s) => daysLeft <= s)
  return reached.length ? reached[reached.length - 1] : null
}

function fmtDate(d: Date) {
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
}

export async function runCertificationReminderCycle() {
  if (isRunning) return { sent: 0 }
  isRunning = true
  try {
    const today = startOfTodayUtc()
    const certs = await prisma.employeeCertification.findMany({
      where: {
        employee: { isActive: true, isDeleted: false },
        certificationType: { isActive: true },
      },
      include: {
        certificationType: { select: { name: true, reminderDays: true } },
        employee: { select: { fullName: true, user: { select: { id: true, isActive: true } } } },
      },
    })

    // Hanya sertifikat yang menentukan (berlaku paling lama) per pegawai+jenis
    // yang diingatkan — sertifikat lama yang sudah diperpanjang tidak berisik.
    const groups = new Map<string, typeof certs>()
    for (const c of certs) {
      const key = `${c.employeeId}:${c.certificationTypeId}`
      groups.set(key, [...(groups.get(key) ?? []), c])
    }

    const forHr: string[] = []
    for (const group of groups.values()) {
      const cert = pickLatest(group)
      if (!cert?.expiryDate) continue
      const left = daysUntil(cert.expiryDate, today)!
      const stage = reachedStage(left, cert.certificationType.reminderDays)
      if (stage === null) continue
      if (cert.lastReminderStage !== null && cert.lastReminderStage <= stage) continue

      const name = cert.certificationType.name
      const when = fmtDate(cert.expiryDate)
      const message =
        left < 0
          ? `${name} sudah kedaluwarsa sejak ${when}. Segera lakukan perpanjangan.`
          : left === 0
            ? `${name} berakhir hari ini (${when}). Segera lakukan perpanjangan.`
            : `${name} berlaku sampai ${when} (${left} hari lagi). Siapkan perpanjangannya.`

      const user = cert.employee.user
      if (user?.isActive) {
        await createNotification({
          userId: user.id,
          title: left < 0 ? "Sertifikat kedaluwarsa" : "Sertifikat segera kedaluwarsa",
          message,
          link: "/pegawai/profil",
        })
      }
      forHr.push(`${cert.employee.fullName}: ${message}`)
      await prisma.employeeCertification.update({ where: { id: cert.id }, data: { lastReminderStage: stage } })
    }

    if (forHr.length > 0) {
      const managers = await prisma.user.findMany({
        where: { isActive: true, role: { name: { in: ["SUPER_ADMIN", "HR_ADMIN"] } } },
        select: { id: true, menuAccess: true, role: { select: { name: true } } },
      })
      const ids = managers
        .filter((m) => m.role.name === "SUPER_ADMIN" || parseMenuAccess(m.menuAccess).includes("kepegawaian.sertifikasi"))
        .map((m) => m.id)
      await createNotificationForUsers(ids, {
        title: "Sertifikat pegawai perlu diperpanjang",
        message:
          forHr.length === 1
            ? forHr[0]
            : `${forHr.length} sertifikat pegawai memasuki masa pengingat atau sudah kedaluwarsa. Lihat rekap Sertifikasi & Pelatihan.`,
        link: "/admin/sertifikasi",
      })
    }
    return { sent: forHr.length }
  } catch (err) {
    console.error("Pengingat sertifikat gagal:", err)
    return { sent: 0 }
  } finally {
    isRunning = false
  }
}

function scheduleNext(delay: number) {
  setTimeout(() => {
    void runCertificationReminderCycle().finally(() => scheduleNext(CHECK_INTERVAL_MS))
  }, delay)
}

export function startCertificationReminders() {
  if (globalThis.__certificationReminderStarted) return
  globalThis.__certificationReminderStarted = true
  scheduleNext(FIRST_RUN_DELAY_MS)
}
