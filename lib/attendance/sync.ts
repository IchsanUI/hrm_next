import { prisma } from "@/lib/prisma"
import { scrapeDevice, type AttendanceRecord } from "@/lib/attendance/scraper"
import { computeAttendanceNote } from "@/lib/attendance/attendance-note"

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

async function saveRecords(records: AttendanceRecord[], location: string): Promise<number> {
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
    },
  })
  const shiftByPin = new Map(
    employees
      .filter((e) => e.workShift)
      .map((e) => [e.pinAttendance as string, e.workShift as { checkInTime: Date; checkOutTime: Date }])
  )

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
  return result.count
}

// Sync SATU device (login + download + parse + simpan). sdate/edate format
// "YYYY-MM-DD" — kosongkan keduanya buat ambil data hari ini saja.
export async function syncDevice(
  device: { name: string; ip: string; loginUser: string; loginPass: string },
  sdate?: string,
  edate?: string
): Promise<DeviceSyncResult> {
  try {
    const { records, uidsFound, rawLineCount, trace, sampleLines } = await scrapeDevice(
      device.ip,
      device.loginUser,
      device.loginPass,
      sdate,
      edate
    )
    const saved = await saveRecords(records, device.name)
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
// menggagalkan device lain, sama seperti attendsync_service.py.
export async function syncAllDevices(sdate?: string, edate?: string): Promise<DeviceSyncResult[]> {
  const devices = await prisma.attendanceDevice.findMany({
    where: { active: true },
    orderBy: { id: "asc" },
  })
  const results: DeviceSyncResult[] = []
  for (const device of devices) {
    results.push(await syncDevice(device, sdate, edate))
  }
  return results
}
