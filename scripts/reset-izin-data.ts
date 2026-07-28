// Hapus SEMUA data pengajuan izin (13 jenis) beserta approval step-nya
// (cascade otomatis lewat FK onDelete: Cascade), lalu reset saldo cuti
// tahunan semua pegawai ke quota default 12 / adjustment 0 / note kosong
// (baris EmployeeLeaveBalance TIDAK dihapus, cuma di-reset).
//
// Jalankan: npx tsx scripts/reset-izin-data.ts
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  const deleted = await prisma.$transaction([
    prisma.overtimeRequest.deleteMany(),
    prisma.officeExitRequest.deleteMany(),
    prisma.earlyLeaveRequest.deleteMany(),
    prisma.lateArrivalRequest.deleteMany(),
    prisma.sickLeaveRequest.deleteMany(),
    prisma.cutiRequest.deleteMany(),
    prisma.maternityLeaveRequest.deleteMany(),
    prisma.specialLeaveRequest.deleteMany(),
    prisma.dispensationRequest.deleteMany(),
    prisma.cutiBesarRequest.deleteMany(),
    prisma.unpaidLeaveRequest.deleteMany(),
    prisma.offSiteAttendanceRequest.deleteMany(),
    prisma.attendanceStatementRequest.deleteMany(),
  ])

  const resetBalance = await prisma.employeeLeaveBalance.updateMany({
    data: { quota: 12, adjustment: 0, note: null },
  })

  const labels = [
    "OvertimeRequest",
    "OfficeExitRequest",
    "EarlyLeaveRequest",
    "LateArrivalRequest",
    "SickLeaveRequest",
    "CutiRequest",
    "MaternityLeaveRequest",
    "SpecialLeaveRequest",
    "DispensationRequest",
    "CutiBesarRequest",
    "UnpaidLeaveRequest",
    "OffSiteAttendanceRequest",
    "AttendanceStatementRequest",
  ]
  deleted.forEach((result, i) => console.log(`${labels[i]}: ${result.count} baris dihapus`))
  console.log(`EmployeeLeaveBalance: ${resetBalance.count} baris di-reset (quota 12, adjustment 0)`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
