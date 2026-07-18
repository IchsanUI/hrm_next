import { PrismaClient } from "@prisma/client"

import { decryptField, encryptField } from "@/lib/encryption"

function encryptValue(value: unknown): unknown {
  return typeof value === "string" && value.length > 0
    ? encryptField(value)
    : value
}

function encryptEmployeeData(data: unknown) {
  if (!data || typeof data !== "object") return
  const record = data as Record<string, unknown>
  if ("nik" in record) record.nik = encryptValue(record.nik)
  if ("illness" in record) record.illness = encryptValue(record.illness)
}

function decryptEmployeeRecord(record: unknown) {
  if (!record || typeof record !== "object") return record
  const obj = record as Record<string, unknown>
  if (typeof obj.nik === "string") obj.nik = decryptField(obj.nik)
  if (typeof obj.illness === "string") obj.illness = decryptField(obj.illness)
  // Relasi bersarang yang mungkin ikut membawa field terenkripsi (mis. include: { reportsTo: true }).
  for (const key of ["headEmployee", "reportsTo"]) {
    if (obj[key] && typeof obj[key] === "object") decryptEmployeeRecord(obj[key])
  }
  if (Array.isArray(obj.directReports)) obj.directReports.forEach(decryptEmployeeRecord)
  if (Array.isArray(obj.employees)) obj.employees.forEach(decryptEmployeeRecord)
  return obj
}

function decryptResult(result: unknown) {
  if (Array.isArray(result)) {
    result.forEach(decryptEmployeeRecord)
  } else {
    decryptEmployeeRecord(result)
  }
  return result
}

// Field sensitif pegawai (NIK, data kesehatan) dienkripsi (AES-256-GCM, lihat
// lib/encryption.ts) sebelum ditulis ke database, dan didekripsi kembali
// setelah dibaca — server actions & halaman lain tidak perlu tahu soal
// enkripsi ini sama sekali. Sengaja dilakukan lewat `query` (bukan `result`)
// extension supaya hasilnya tetap plain object biasa (aman dikirim dari
// Server Component ke Client Component).
function createPrismaClient() {
  return new PrismaClient().$extends({
    name: "employee-sensitive-field-encryption",
    query: {
      employee: {
        async $allOperations({ operation, args, query }) {
          const typedArgs = args as {
            data?: unknown
            create?: unknown
            update?: unknown
          }
          if (
            operation === "create" ||
            operation === "update" ||
            operation === "updateMany"
          ) {
            encryptEmployeeData(typedArgs.data)
          } else if (operation === "createMany") {
            if (Array.isArray(typedArgs.data)) {
              typedArgs.data.forEach(encryptEmployeeData)
            } else {
              encryptEmployeeData(typedArgs.data)
            }
          } else if (operation === "upsert") {
            encryptEmployeeData(typedArgs.create)
            encryptEmployeeData(typedArgs.update)
          }

          const result = await query(args)
          return decryptResult(result)
        },
      },
    },
  })
}

type PrismaClientWithExtensions = ReturnType<typeof createPrismaClient>

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClientWithExtensions | undefined
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma
