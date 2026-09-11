import { prisma } from "@/lib/prisma"
import { scrapeDevice, type AttendanceRecord } from "@/lib/attendance/scraper"
import { computeAttendanceNote } from "@/lib/attendance/attendance-note"
import { createNotification } from "@/lib/notifications"
import { getAttendanceClosing } from "@/lib/greeting"

export type DeviceSyncResult = {
  deviceName: string
  saved: number
  error: string | null
  // Diagnostik — buat lacak di tahap mana data "hilang" kalau saved lebih
  // kecil dari yang diharapkan: uidsFound (jumlah PIN yang diminta ke
  // mesin) vs rawLineCount (baris attlog mentah yang dikembalikan mesin)
  // vs saved (baris valid yang tersimpan, sesudah dedup/skip).
  uidsFound: number
  rawLineCount: number
  trace: string[]
  sampleLines: string[]
}

// `notify` — SENGAJA cuma true kalau dipanggil dari scheduler otomatis
// (lib/attendance/auto-sync-scheduler.ts), BUKAN dari tombol "Ambil Data
// Mesin" manual (server/actions/attendance.ts) — supaya sync manual (mis.
// buat re-fetch/koreksi tanggal lama) tidak diam-diam nge-spam pegawai.
async function saveRecords(records: AttendanceRecord[], location: string, notify: boolean): Promise<number> {
  if (records.length === 0) return 0

  // Ambil shift pegawai yang PIN-nya kepakai di batch ini SEKALI (bukan
  // per-record) — buat hitung note (Terlambat/Pulang Cepat) sebelum
  // disimpan, supaya nanti diambil lagi tinggal baca kolomnya langsung.
  const pins = Array.from(new Set(records.map((r) => r.userPin)))
  const employees = await prisma.employee.findMany({
    where: { pinAttendance: { in: pins } },
    select: {
      pinAttendance: true,
      workShift: { select: { checkInTime: true, checkOutTime: true } },
      user: { select: { id: true } },
    },
  })
  const shiftByPin = new Map(
    employees
      .filter((e) => e.workShift)
      .map((e) => [e.pinAttendance as string, e.workShift as { checkInTime: Date; checkOutTime: Date }])
  )
  const employeeByPin = new Map(employees.map((e) => [e.pinAttendance as string, e]))

  // Cari record yang SUDAH ada dulu (sebelum insert) — supaya notifikasi
  // cuma dikirim buat baris yang BENAR-BENAR baru, bukan baris yang sudah
  // pernah tersinkron siklus sebelumnya (kunci unik: userPin+location+logTime,
  // sama seperti @@unique di skema AttendanceLog).
  let newRecords = records
  if (notify) {
    const existing = await prisma.attendanceLog.findMany({
      where: { OR: records.map((r) => ({ userPin: r.userPin, location, logTime: r.logTime })) },
      select: { userPin: true, logTime: true },
    })
    const existingKeys = new Set(existing.map((e) => `${e.userPin}|${e.logTime.toISOString()}`))
    newRecords = records.filter((r) => !existingKeys.has(`${r.userPin}|${r.logTime.toISOString()}`))
  }

  const result = await prisma.attendanceLog.createMany({
    data: records.map((r) => ({
      userPin: r.userPin,
      name: r.name,
      location,
      logTime: r.logTime,
      verifyType: r.verifyType,
      logType: r.logType,
      note: computeAttendanceNote(r.logType, r.logTime, shiftByPin.get(r.userPin) ?? null),
    })),
    skipDuplicates: true,
  })

  if (notify && newRecords.length > 0) {
    for (const r of newRecords) {
      const userId = employeeByPin.get(r.userPin)?.user?.id
      if (!userId) continue
      const time = r.logTime.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
      await createNotification({
        userId,
        title: "Absen Berhasil",
        // Penutupnya ikut jam TAP-nya (r.logTime), bukan jam saat sync
        // berjalan — sinkronisasi bisa tertunda/menyusul beberapa jam, dan
        // kalau memakai jam sekarang bisa muncul "selamat istirahat" untuk
        // absen masuk pagi yang baru ke-sync sore hari.
        message: `Anda berhasil absen pada jam ${time}. ${getAttendanceClosing(r.logTime)}`,
        link: "/pegawai/absensi",
      })
    }
  }

  return result.count
}

// Sync SATU device (login + download + parse + simpan). sdate/edate format
// "YYYY-MM-DD" — kosongkan keduanya buat ambil data hari ini saja. `notify`
// — lihat catatan di saveRecords, default false (aman kalau ada pemanggil
// lama yang belum di-update).
export async function syncDevice(
  device: { name: string; ip: string; loginUser: string; loginPass: string },
  sdate?: string,
  edate?: string,
  notify = false
): Promise<DeviceSyncResult> {
  try {
    const { records, uidsFound, rawLineCount, trace, sampleLines } = await scrapeDevice(
      device.ip,
      device.loginUser,
      device.loginPass,
      sdate,
      edate
    )
    const saved = await saveRecords(records, device.name, notify)
    return { deviceName: device.name, saved, error: null, uidsFound, rawLineCount, trace, sampleLines }
  } catch (e) {
    return {
      deviceName: device.name,
      saved: 0,
      error: e instanceof Error ? e.message : "Gagal sync",
      uidsFound: 0,
      rawLineCount: 0,
      trace: [],
      sampleLines: [],
    }
  }
}

// Sync SEMUA device aktif secara berurutan — satu device gagal tidak
// menggagalkan device lain, sama seperti attendsync_service.py. `notify` —
// lihat catatan di saveRecords: cuma diisi true oleh scheduler otomatis.
export async function syncAllDevices(
  sdate?: string,
  edate?: string,
  notify = false
): Promise<DeviceSyncResult[]> {
  const devices = await prisma.attendanceDevice.findMany({
    where: { active: true },
    orderBy: { id: "asc" },
  })
  const results: DeviceSyncResult[] = []
  for (const device of devices) {
    results.push(await syncDevice(device, sdate, edate, notify))
  }
  return results
}
