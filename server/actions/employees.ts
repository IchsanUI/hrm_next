"use server"

import { Prisma, RoleName } from "@prisma/client"
import bcrypt from "bcryptjs"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import ExcelJS from "exceljs"

import { auth } from "@/auth"
import { computeContractEndDate, generateSecurePassword } from "@/lib/employee-utils"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity-log"
import { employeeFormSchema, type EmployeeFormValues } from "@/lib/validations/employee"
import { buildEmployeeNumber } from "@/lib/employee-number-generator"

export type EmployeeFormState = {
  error?: string
  fieldErrors?: Record<string, string[] | undefined>
  success?: {
    employeePublicId: string
    fullName: string
    username: string
    password: string
  }
} | undefined

function parseEmployeeForm(formData: FormData) {
  return employeeFormSchema.safeParse(Object.fromEntries(formData))
}

function parseOptionalId(value: number | "" | undefined) {
  return value === "" || value === undefined ? null : value
}

function buildPersonalFields(data: EmployeeFormValues) {
  return {
    pinAttendance: data.pinAttendance || null,
    lastEducation: data.lastEducation || null,
    major: data.major || null,
    degree: data.degree || null,
    maritalStatus: data.maritalStatus || null,
    exitLetterNumber: data.exitLetterNumber || null,
    hobby: data.hobby || null,
    emergencyPhone: data.emergencyPhone || null,
    instagram: data.instagram || null,
    tiktok: data.tiktok || null,
    facebook: data.facebook || null,
    ktpAddress: data.ktpAddress || null,
    domicileKtp: data.domicileKtp || null,
    motherName: data.motherName || null,
    fatherName: data.fatherName || null,
    illness: data.illness || null,
    sideBusiness: data.sideBusiness || null,
    npwp: data.npwp || null,
    ptkpStatus: data.ptkpStatus || null,
  }
}

// Inti pembuatan Employee + User berpasangan (dipakai form tambah satuan
// maupun import Excel massal) — dipisah dari action-nya supaya logika
// transaksi & mapping error P2002 cuma ada SEKALI, biar dua jalur create
// tidak diam-diam melenceng dari waktu ke waktu.
async function createEmployeeRecord(
  data: EmployeeFormValues,
  employmentStatusName: string,
  employeeRoleId: number
): Promise<{ employeePublicId: string; password: string } | { error: string }> {
  const startDate = new Date(data.startDate)
  const birthDate = new Date(data.birthDate)
  const contractEndDate = computeContractEndDate(startDate, employmentStatusName)
  const resignDate = data.resignDate ? new Date(data.resignDate) : null
  const temporaryPassword = generateSecurePassword()
  let employeePublicId = ""

  try {
    await prisma.$transaction(async (tx) => {
      const employee = await tx.employee.create({
        data: {
          employeeNumber: data.employeeNumber,
          fullName: data.fullName,
          startDate,
          contractEndDate,
          resignDate,
          departmentId: data.departmentId,
          positionId: data.positionId,
          workLocationId: data.workLocationId,
          employmentStatusId: data.employmentStatusId,
          reportsToId: parseOptionalId(data.reportsToId),
          workShiftId: parseOptionalId(data.workShiftId),
          salaryGradeId: parseOptionalId(data.salaryGradeId),
          salaryGradeStep: parseOptionalId(data.salaryGradeStep),
          birthDate,
          birthPlace: data.birthPlace,
          gender: data.gender,
          nik: data.nik,
          address: data.address,
          phone: data.phone,
          email: data.email,
          ...buildPersonalFields(data),
        },
      })
      employeePublicId = employee.publicId

      const passwordHash = await bcrypt.hash(temporaryPassword, 10)
      await tx.user.create({
        data: {
          username: data.employeeNumber,
          password: passwordHash,
          roleId: employeeRoleId,
          employeeId: employee.id,
          isActive: true,
        },
      })
    })
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      const target = (err.meta?.target as string[] | undefined) ?? []
      if (target.includes("pinAttendance")) {
        return { error: "PIN mesin absensi ini sudah dipakai pegawai lain." }
      }
      return { error: "NIP sudah terpakai oleh pegawai/akun lain." }
    }
    throw err
  }

  return { employeePublicId, password: temporaryPassword }
}

export type GenerateEmployeeNumberState = { error?: string; employeeNumber?: string } | undefined

// Dipanggil dari tombol "Generate Otomatis" di NIP saat Tambah Pegawai —
// lihat lib/employee-number-generator.ts untuk skemanya. Field yang
// dibutuhkan (status kepegawaian, mulai kerja, tanggal lahir) diambil dari
// FormData form yang sedang diisi (belum di-submit), bukan dari database.
export async function generateEmployeeNumberAction(
  _prevState: GenerateEmployeeNumberState,
  formData: FormData
): Promise<GenerateEmployeeNumberState> {
  const employmentStatusId = Number(formData.get("employmentStatusId"))
  const startDateRaw = String(formData.get("startDate") ?? "")
  const birthDateRaw = String(formData.get("birthDate") ?? "")

  if (!employmentStatusId || !startDateRaw || !birthDateRaw) {
    return { error: "Isi Status Kepegawaian, Mulai Kerja, dan Tanggal Lahir dulu sebelum generate NIP." }
  }

  const status = await prisma.employmentStatus.findUnique({ where: { id: employmentStatusId } })
  if (!status) return { error: "Status kepegawaian tidak ditemukan." }

  // Termasuk baris yang sudah di-soft-delete — nomor urut tidak pernah
  // dipakai ulang meski ada pegawai yang dihapus.
  const totalEmployees = await prisma.employee.count()

  const employeeNumber = buildEmployeeNumber({
    employmentStatusName: status.name,
    startDate: new Date(startDateRaw),
    birthDate: new Date(birthDateRaw),
    sequence: totalEmployees + 1,
  })

  return { employeeNumber }
}

export async function createEmployeeAction(
  _prevState: EmployeeFormState,
  formData: FormData
): Promise<EmployeeFormState> {
  const parsed = parseEmployeeForm(formData)
  if (!parsed.success) {
    return {
      error: "Periksa kembali data yang diisi.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    }
  }
  const data = parsed.data

  const employmentStatus = await prisma.employmentStatus.findUnique({
    where: { id: data.employmentStatusId },
  })
  if (!employmentStatus) {
    return { error: "Status kepegawaian tidak valid." }
  }

  const employeeRole = await prisma.role.findUnique({
    where: { name: RoleName.EMPLOYEE },
  })
  if (!employeeRole) {
    return { error: "Role EMPLOYEE belum tersedia. Jalankan seed terlebih dahulu." }
  }

  const session = await auth()
  const result = await createEmployeeRecord(data, employmentStatus.name, employeeRole.id)
  if ("error" in result) {
    return { error: result.error }
  }

  await logActivity({
    userId: session?.user.id ? Number(session.user.id) : null,
    username: session?.user.username ?? "system",
    action: "CREATE",
    entityType: "Employee",
    description: `${session?.user.username ?? "system"} menambahkan pegawai baru "${data.fullName}" (${data.employeeNumber}).`,
  })

  revalidatePath("/admin/pegawai")
  return {
    success: {
      employeePublicId: result.employeePublicId,
      fullName: data.fullName,
      username: data.employeeNumber,
      password: result.password,
    },
  }
}

export async function updateEmployeeAction(
  employeeId: number,
  _prevState: EmployeeFormState,
  formData: FormData
): Promise<EmployeeFormState> {
  const parsed = parseEmployeeForm(formData)
  if (!parsed.success) {
    return {
      error: "Periksa kembali data yang diisi.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    }
  }
  const data = parsed.data

  const employmentStatus = await prisma.employmentStatus.findUnique({
    where: { id: data.employmentStatusId },
  })
  if (!employmentStatus) {
    return { error: "Status kepegawaian tidak valid." }
  }

  const reportsToId = parseOptionalId(data.reportsToId)
  if (reportsToId === employeeId) {
    return { error: "Pegawai tidak bisa melapor kepada dirinya sendiri." }
  }
  const workShiftId = parseOptionalId(data.workShiftId)
  const salaryGradeId = parseOptionalId(data.salaryGradeId)
  const salaryGradeStep = parseOptionalId(data.salaryGradeStep)

  const startDate = new Date(data.startDate)
  const birthDate = new Date(data.birthDate)
  const contractEndDate = computeContractEndDate(startDate, employmentStatus.name)
  const resignDate = data.resignDate ? new Date(data.resignDate) : null
  const session = await auth()

  try {
    await prisma.employee.update({
      where: { id: employeeId },
      data: {
        employeeNumber: data.employeeNumber,
        fullName: data.fullName,
        startDate,
        contractEndDate,
        resignDate,
        departmentId: data.departmentId,
        positionId: data.positionId,
        workLocationId: data.workLocationId,
        employmentStatusId: data.employmentStatusId,
        reportsToId,
        workShiftId,
        salaryGradeId,
        salaryGradeStep,
        birthDate,
        birthPlace: data.birthPlace,
        gender: data.gender,
        nik: data.nik,
        address: data.address,
        phone: data.phone,
        email: data.email,
        ...buildPersonalFields(data),
      },
    })
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      const target = (err.meta?.target as string[] | undefined) ?? []
      if (target.includes("pinAttendance")) {
        return { error: "PIN mesin absensi ini sudah dipakai pegawai lain." }
      }
      return { error: "NIP sudah terpakai oleh pegawai lain." }
    }
    throw err
  }

  await logActivity({
    userId: session?.user.id ? Number(session.user.id) : null,
    username: session?.user.username ?? "system",
    action: "UPDATE",
    entityType: "Employee",
    description: `${session?.user.username ?? "system"} memperbarui data pegawai "${data.fullName}" (${data.employeeNumber}).`,
  })

  revalidatePath("/admin/pegawai")
  redirect("/admin/pegawai?toast=employee-updated")
}

// resignDate diisi kalau alasan hapusnya "Resign" — DISENGAJA tetap
// diproses dalam SATU aksi yang sama dengan soft-delete (bukan dua langkah
// terpisah kayak sebelumnya, yang gampang salah urutan kalau HR lupa
// generate payroll dulu). Payroll (generatePayslipsAction) query pegawainya
// sekarang ikut ngecek resignDate >= awal periode, jadi pegawai yang sudah
// di-soft-delete TETAP ikut diproses untuk periode yang masih mengandung
// tanggal resign-nya (termasuk rekonsiliasi Pasal 17-nya), dan otomatis
// lolos/tidak ikut lagi buat periode-periode setelahnya — tidak perlu lagi
// nunggu payroll selesai baru boleh hapus.
export async function softDeleteEmployeeAction(
  employeeId: number,
  reason: string,
  resignDate: string | null
) {
  const session = await auth()
  const deletedBy = session?.user.username ?? "system"

  const employee = await prisma.$transaction(async (tx) => {
    const updated = await tx.employee.update({
      where: { id: employeeId },
      data: {
        isDeleted: true,
        isActive: false,
        deleteReason: reason || null,
        deletedAt: new Date(),
        deletedBy,
        ...(resignDate ? { resignDate: new Date(resignDate) } : {}),
      },
    })
    await tx.user.updateMany({
      where: { employeeId },
      data: { isActive: false },
    })
    return updated
  })

  await logActivity({
    userId: session?.user.id ? Number(session.user.id) : null,
    username: deletedBy,
    action: "DELETE",
    entityType: "Employee",
    description: `${deletedBy} menghapus (soft-delete) pegawai "${employee.fullName}" (${employee.employeeNumber}).${reason ? ` Alasan: ${reason}` : ""}${resignDate ? ` Tanggal resign: ${resignDate}.` : ""}`,
  })

  revalidatePath("/admin/pegawai")
}

export async function restoreEmployeeAction(employeeId: number, reason: string) {
  const session = await auth()

  const employee = await prisma.$transaction(async (tx) => {
    const updated = await tx.employee.update({
      where: { id: employeeId },
      data: {
        isDeleted: false,
        isActive: true,
        deleteReason: null,
        deletedAt: null,
        deletedBy: null,
        // Dipulihkan berarti batal resign — resignDate ikut dikosongkan
        // supaya tidak diam-diam ngecualiin dia dari payroll periode
        // mendatang gara-gara tanggal lama yang sudah tidak relevan.
        resignDate: null,
      },
    })
    await tx.user.updateMany({
      where: { employeeId },
      data: { isActive: true },
    })
    return updated
  })

  await logActivity({
    userId: session?.user.id ? Number(session.user.id) : null,
    username: session?.user.username ?? "system",
    action: "RESTORE",
    entityType: "Employee",
    description: `${session?.user.username ?? "system"} memulihkan pegawai "${employee.fullName}" (${employee.employeeNumber}).${reason ? ` Alasan: ${reason}` : ""}`,
  })

  revalidatePath("/admin/pegawai")
}

// Admin buka/tutup "jendela" update mandiri per pegawai — dipakai buat pola
// update data tahunan (lihat catatan di Employee.allowSelfUpdate). Otomatis
// terkunci lagi begitu pegawai berhasil menyimpan lewat updateOwnProfileAction.
export async function toggleEmployeeSelfUpdateAction(employeeId: number, enabled: boolean) {
  const session = await auth()
  const isAdminRole = session?.user.role === "SUPER_ADMIN" || session?.user.role === "HR_ADMIN"
  if (!session?.user || !isAdminRole) {
    throw new Error("Anda tidak berwenang mengubah izin ini.")
  }

  const employee = await prisma.employee.update({
    where: { id: employeeId },
    data: { allowSelfUpdate: enabled },
  })

  await logActivity({
    userId: Number(session.user.id),
    username: session.user.username,
    action: "UPDATE",
    entityType: "Employee",
    description: `${session.user.username} ${enabled ? "mengaktifkan" : "menonaktifkan"} izin update mandiri untuk "${employee.fullName}" (${employee.employeeNumber}).`,
  })

  revalidatePath("/admin/pegawai")
}

// Admin buka pengecualian Cuti Khusus Haji/Umroh per pegawai (Pasal 41
// membatasi 1x seumur bekerja per jenis) — otomatis dipadamkan lagi begitu
// terpakai untuk satu pengajuan baru, lihat server/actions/special-leave.ts.
export async function toggleSpecialLeaveExceptionAction(
  employeeId: number,
  type: "HAJI" | "UMROH",
  enabled: boolean
) {
  const session = await auth()
  const isAdminRole = session?.user.role === "SUPER_ADMIN" || session?.user.role === "HR_ADMIN"
  if (!session?.user || !isAdminRole) {
    throw new Error("Anda tidak berwenang mengubah izin ini.")
  }

  const employee = await prisma.employee.update({
    where: { id: employeeId },
    data:
      type === "HAJI"
        ? { allowSpecialLeaveExceptionHaji: enabled }
        : { allowSpecialLeaveExceptionUmroh: enabled },
  })

  const typeLabel = type === "HAJI" ? "Haji" : "Umroh"
  await logActivity({
    userId: Number(session.user.id),
    username: session.user.username,
    action: "UPDATE",
    entityType: "Employee",
    description: `${session.user.username} ${enabled ? "membuka" : "menutup"} pengecualian Cuti Khusus ${typeLabel} untuk "${employee.fullName}" (${employee.employeeNumber}).`,
  })

  revalidatePath("/admin/pegawai")
  revalidatePath(`/admin/pegawai/${employee.publicId}/detail`)
}

// Admin buka pengecualian Cuti Besar per pegawai (Pasal 38 membatasi 2x
// seumur bekerja) — otomatis dipadamkan lagi begitu terpakai untuk satu
// pengajuan baru, lihat server/actions/cuti-besar.ts.
export async function toggleCutiBesarExceptionAction(employeeId: number, enabled: boolean) {
  const session = await auth()
  const isAdminRole = session?.user.role === "SUPER_ADMIN" || session?.user.role === "HR_ADMIN"
  if (!session?.user || !isAdminRole) {
    throw new Error("Anda tidak berwenang mengubah izin ini.")
  }

  const employee = await prisma.employee.update({
    where: { id: employeeId },
    data: { allowCutiBesarException: enabled },
  })

  await logActivity({
    userId: Number(session.user.id),
    username: session.user.username,
    action: "UPDATE",
    entityType: "Employee",
    description: `${session.user.username} ${enabled ? "membuka" : "menutup"} pengecualian Cuti Besar untuk "${employee.fullName}" (${employee.employeeNumber}).`,
  })

  revalidatePath("/admin/pegawai")
  revalidatePath(`/admin/pegawai/${employee.publicId}/detail`)
}

export type ImportEmployeeState =
  | { error: string; success?: undefined }
  | {
      success: true
      imported: number
      failed: number
      errors: string[]
      credentials: { employeeNumber: string; fullName: string; password: string }[]
    }
  | undefined

// Sama seperti parseTemplateDate di server/actions/national-holidays.ts —
// terima Date asli (Excel serial date) atau string "DD-MM-YYYY"/"YYYY-MM-DD".
// Diduplikasi (bukan diimpor lintas file) supaya format tanggal pegawai
// bebas berubah tanpa menyeret format hari libur, dan sebaliknya.
function parseImportDate(raw: unknown): string | null {
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    return `${raw.getFullYear()}-${String(raw.getMonth() + 1).padStart(2, "0")}-${String(raw.getDate()).padStart(2, "0")}`
  }
  if (typeof raw === "string") {
    const value = raw.trim()
    const ddmmyyyy = value.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/)
    if (ddmmyyyy) {
      const [, d, m, y] = ddmmyyyy
      return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`
    }
    const yyyymmdd = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
    if (yyyymmdd) return value
  }
  return null
}

function cellText(raw: unknown): string {
  if (raw === null || raw === undefined) return ""
  if (typeof raw === "object" && "text" in raw) return String((raw as { text: unknown }).text ?? "").trim()
  return String(raw).trim()
}

function parseImportGender(raw: unknown): "MALE" | "FEMALE" | null {
  const value = cellText(raw).toLowerCase()
  if (value === "l" || value.startsWith("laki")) return "MALE"
  if (value === "p" || value.startsWith("perempuan")) return "FEMALE"
  return null
}

// Import massal pegawai dari Excel (template: /api/master-data/pegawai/template).
// Tiap baris divalidasi lewat employeeFormSchema yang SAMA dengan form tambah
// satuan, supaya aturan wajib/opsional-nya tidak dobel didefinisikan. Bagian/
// Jabatan/Lokasi Kerja/Status Kepegawaian/Shift dicocokkan dari NAMA (bukan
// ID) berdasarkan data yang sudah ada di sistem — lihat sheet "Referensi" di
// templatenya.
export async function importEmployeesAction(
  _prevState: ImportEmployeeState,
  formData: FormData
): Promise<ImportEmployeeState> {
  const file = formData.get("file")
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Pilih file Excel terlebih dahulu." }
  }

  const workbook = new ExcelJS.Workbook()
  try {
    await workbook.xlsx.load(await file.arrayBuffer())
  } catch {
    return { error: "File tidak bisa dibaca. Pastikan formatnya .xlsx sesuai template." }
  }

  const sheet = workbook.getWorksheet("Data Pegawai") ?? workbook.worksheets[0]
  if (!sheet) {
    return { error: "File Excel tidak memiliki sheet data." }
  }

  const employeeRole = await prisma.role.findUnique({ where: { name: RoleName.EMPLOYEE } })
  if (!employeeRole) {
    return { error: "Role EMPLOYEE belum tersedia. Jalankan seed terlebih dahulu." }
  }

  const [departments, positions, workLocations, employmentStatuses] = await Promise.all([
    prisma.department.findMany({ where: { isActive: true } }),
    prisma.position.findMany(),
    prisma.workLocation.findMany(),
    prisma.employmentStatus.findMany(),
  ])
  const byName = <T extends { name: string }>(items: T[]) => {
    const map = new Map<string, T[]>()
    for (const item of items) {
      const key = item.name.trim().toLowerCase()
      map.set(key, [...(map.get(key) ?? []), item])
    }
    return map
  }
  const departmentMap = byName(departments)
  const positionMap = byName(positions)
  const workLocationMap = byName(workLocations)
  const employmentStatusMap = byName(employmentStatuses)

  function resolveSingle<T extends { id: number }>(
    map: Map<string, T[]>,
    name: string,
    label: string,
    rowNumber: number,
    errors: string[]
  ): number | null {
    const matches = map.get(name.trim().toLowerCase()) ?? []
    if (matches.length === 0) {
      errors.push(`Baris ${rowNumber}: ${label} "${name}" tidak ditemukan. Cek sheet Referensi.`)
      return null
    }
    if (matches.length > 1) {
      errors.push(`Baris ${rowNumber}: ${label} "${name}" ambigu (ada lebih dari satu). Atur manual setelah import.`)
      return null
    }
    return matches[0].id
  }

  const errors: string[] = []
  const parsedRows: { rowNumber: number; data: EmployeeFormValues; employmentStatusName: string }[] = []
  const seenEmployeeNumbers = new Set<string>()

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return // header
    const employeeNumber = cellText(row.getCell(1).value)
    const fullName = cellText(row.getCell(2).value)
    if (!employeeNumber && !fullName) return // baris kosong

    if (seenEmployeeNumbers.has(employeeNumber)) {
      errors.push(`Baris ${rowNumber}: NIP "${employeeNumber}" duplikat di dalam file ini.`)
      return
    }

    const departmentName = cellText(row.getCell(4).value)
    const positionName = cellText(row.getCell(5).value)
    const workLocationName = cellText(row.getCell(6).value)
    const employmentStatusName = cellText(row.getCell(7).value)

    const departmentId = departmentName
      ? resolveSingle(departmentMap, departmentName, "Bagian", rowNumber, errors)
      : (errors.push(`Baris ${rowNumber}: Bagian wajib diisi.`), null)
    const positionId = positionName
      ? resolveSingle(positionMap, positionName, "Jabatan", rowNumber, errors)
      : (errors.push(`Baris ${rowNumber}: Jabatan wajib diisi.`), null)
    const workLocationId = workLocationName
      ? resolveSingle(workLocationMap, workLocationName, "Lokasi Kerja", rowNumber, errors)
      : (errors.push(`Baris ${rowNumber}: Lokasi Kerja wajib diisi.`), null)
    const employmentStatusId = employmentStatusName
      ? resolveSingle(employmentStatusMap, employmentStatusName, "Status Kepegawaian", rowNumber, errors)
      : (errors.push(`Baris ${rowNumber}: Status Kepegawaian wajib diisi.`), null)

    const startDate = parseImportDate(row.getCell(3).value)
    const birthDate = parseImportDate(row.getCell(8).value)
    const gender = parseImportGender(row.getCell(10).value)

    if (!startDate) errors.push(`Baris ${rowNumber}: Tanggal Mulai Kerja tidak valid.`)
    if (!birthDate) errors.push(`Baris ${rowNumber}: Tanggal Lahir tidak valid.`)
    if (!gender) errors.push(`Baris ${rowNumber}: Jenis Kelamin harus diisi L atau P.`)
    if (!departmentId || !positionId || !workLocationId || !employmentStatusId || !startDate || !birthDate || !gender) {
      return
    }

    const candidate: Record<string, unknown> = {
      employeeNumber,
      fullName,
      startDate,
      departmentId: String(departmentId),
      positionId: String(positionId),
      workLocationId: String(workLocationId),
      employmentStatusId: String(employmentStatusId),
      birthDate,
      birthPlace: cellText(row.getCell(9).value),
      gender,
      nik: cellText(row.getCell(11).value),
      address: cellText(row.getCell(12).value),
      phone: cellText(row.getCell(13).value),
      email: cellText(row.getCell(14).value),
    }

    const parsed = employeeFormSchema.safeParse(candidate)
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors
      const messages = Object.values(fieldErrors).flat().filter(Boolean)
      errors.push(`Baris ${rowNumber}: ${messages.join(", ") || "data tidak valid."}`)
      return
    }

    seenEmployeeNumbers.add(employeeNumber)
    parsedRows.push({ rowNumber, data: parsed.data, employmentStatusName })
  })

  if (parsedRows.length === 0) {
    return { error: errors[0] ?? "Tidak ada data pegawai yang valid pada file." }
  }

  const session = await auth()
  let imported = 0
  let failed = 0
  const credentials: { employeeNumber: string; fullName: string; password: string }[] = []

  for (const { rowNumber, data, employmentStatusName } of parsedRows) {
    const result = await createEmployeeRecord(data, employmentStatusName, employeeRole.id)
    if ("error" in result) {
      failed += 1
      errors.push(`Baris ${rowNumber}: ${result.error}`)
      continue
    }
    imported += 1
    credentials.push({ employeeNumber: data.employeeNumber, fullName: data.fullName, password: result.password })
  }

  if (imported > 0) {
    await logActivity({
      userId: session?.user.id ? Number(session.user.id) : null,
      username: session?.user.username ?? "system",
      action: "CREATE",
      entityType: "Employee",
      description: `${session?.user.username ?? "system"} mengimpor ${imported} pegawai baru dari Excel.`,
    })
    revalidatePath("/admin/pegawai")
  }

  return { success: true, imported, failed, errors, credentials }
}
