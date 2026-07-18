import { RoleName, Gender, MaritalStatus } from "@prisma/client"
import bcrypt from "bcryptjs"

import { computeContractEndDate, initialPasswordFromBirthDate } from "../lib/employee-utils"
import { prisma } from "../lib/prisma"

const KANTOR_PUSAT = "Kantor Pusat Gresik"

type FamilyInput = {
  spouse?: { fullName: string; occupation: string; birthPlace: string; birthDate: string }
  children?: { fullName: string; birthPlace: string; birthDate: string }[]
}

type ChartNode = FamilyInput & {
  fullName: string
  position: string
  department: string
  workLocation?: string
  workShift?: string
  gender: Gender
  birthDate: string
  birthPlace: string
  startDate: string
  isDeptHead?: boolean
}

// Struktur mengikuti bagan organisasi Bank Gresik, mulai dari Direktur Utama
// ke bawah (Bupati/PSP dan Dewan Pengawas tidak dimodelkan sebagai pegawai).
// `children` = anak kandung (data keluarga); bawahan organisasi memakai `reports`.
type OrgNode = ChartNode & { reports?: OrgNode[] }

const tree: OrgNode = {
  fullName: "Ahmad Wijaya",
  position: "Direktur Utama",
  department: "DIR",
  gender: Gender.MALE,
  birthDate: "1975-04-10",
  birthPlace: "Gresik",
  startDate: "2005-01-10",
  isDeptHead: true,
  spouse: {
    fullName: "Siti Rahayu",
    occupation: "Ibu Rumah Tangga",
    birthPlace: "Gresik",
    birthDate: "1977-06-15",
  },
  children: [
    { fullName: "Andi Wijaya", birthPlace: "Gresik", birthDate: "2003-02-01" },
    { fullName: "Ayu Wijaya", birthPlace: "Gresik", birthDate: "2006-09-12" },
  ],
  reports: [
    {
      fullName: "Kartono Wibowo",
      position: "Kabag Audit Internal",
      department: "AUD",
      gender: Gender.MALE,
      birthDate: "1978-02-11",
      birthPlace: "Gresik",
      startDate: "2007-03-01",
      isDeptHead: true,
      reports: [
        {
          fullName: "Yusuf Maulana",
          position: "Audit Internal",
          department: "AUD",
          gender: Gender.MALE,
          birthDate: "1992-08-20",
          birthPlace: "Surabaya",
          startDate: "2018-05-14",
        },
      ],
    },
    {
      fullName: "Wahyu Setiawan",
      position: "Kabag Kepatuhan, Manajemen Risiko & APU PPT",
      department: "KEP",
      gender: Gender.MALE,
      birthDate: "1980-11-03",
      birthPlace: "Gresik",
      startDate: "2009-06-01",
      isDeptHead: true,
    },
    {
      fullName: "Slamet Riyadi",
      position: "Direktur",
      department: "DIR",
      gender: Gender.MALE,
      birthDate: "1977-09-25",
      birthPlace: "Lamongan",
      startDate: "2006-08-15",
      spouse: {
        fullName: "Endang Sulistyowati",
        occupation: "Guru",
        birthPlace: "Lamongan",
        birthDate: "1979-01-18",
      },
      reports: [
        {
          fullName: "Ratna Nirmalawati",
          position: "Kabag Operasional",
          department: "OPS",
          gender: Gender.FEMALE,
          birthDate: "1976-02-14",
          birthPlace: "Gresik",
          startDate: "2002-03-01",
          isDeptHead: true,
          spouse: {
            fullName: "Agus Budiyono",
            occupation: "Karyawan Swasta",
            birthPlace: "Demak",
            birthDate: "1970-07-15",
          },
          children: [
            { fullName: "Rizky Budiyono", birthPlace: "Gresik", birthDate: "2004-05-20" },
          ],
          reports: [
            {
              fullName: "Dian Puspitasari",
              position: "Kasi Operasional & Pelayanan",
              department: "OPS",
              gender: Gender.FEMALE,
              birthDate: "1988-03-09",
              birthPlace: "Gresik",
              startDate: "2013-04-01",
              reports: [
                {
                  fullName: "Nurul Alwiyah",
                  position: "Teller",
                  department: "OPS",
                  gender: Gender.FEMALE,
                  birthDate: "1990-01-20",
                  birthPlace: "Gresik",
                  startDate: "2015-06-01",
                },
                {
                  fullName: "Fahrul Alam",
                  position: "Accounting",
                  department: "OPS",
                  gender: Gender.MALE,
                  birthDate: "1997-10-08",
                  birthPlace: "Gresik",
                  startDate: "2025-03-03",
                },
                {
                  fullName: "Rina Kusumawati",
                  position: "Customer Service",
                  department: "OPS",
                  gender: Gender.FEMALE,
                  birthDate: "1995-12-02",
                  birthPlace: "Surabaya",
                  startDate: "2021-02-01",
                },
                {
                  fullName: "Agus Purnomo",
                  position: "Admin Kredit",
                  department: "OPS",
                  gender: Gender.MALE,
                  birthDate: "1993-06-17",
                  birthPlace: "Gresik",
                  startDate: "2019-09-16",
                },
              ],
            },
            {
              fullName: "Bambang Sutrisno",
              position: "Kepala Kas",
              department: "OPS",
              gender: Gender.MALE,
              birthDate: "1985-07-22",
              birthPlace: "Gresik",
              startDate: "2012-01-10",
              reports: [
                {
                  fullName: "Eko Prasetyo",
                  position: "Admin/Teller Kas Bungah",
                  department: "OPS",
                  workLocation: "Kas Bungah",
                  workShift: "Shift Outsourcing Pagi",
                  gender: Gender.MALE,
                  birthDate: "1994-04-05",
                  birthPlace: "Gresik",
                  startDate: "2020-01-06",
                },
                {
                  fullName: "Hendra Gunawan",
                  position: "Admin/Teller Kas Menganti",
                  department: "OPS",
                  workLocation: "Kas Menganti",
                  workShift: "Shift Outsourcing Pagi",
                  gender: Gender.MALE,
                  birthDate: "1996-02-14",
                  birthPlace: "Gresik",
                  startDate: "2022-07-11",
                },
              ],
            },
          ],
        },
        {
          fullName: "Dewi Anggraini",
          position: "Kabag Penelitian & Pengembangan",
          department: "LIT",
          gender: Gender.FEMALE,
          birthDate: "1983-05-30",
          birthPlace: "Lamongan",
          startDate: "2011-02-14",
          isDeptHead: true,
        },
        {
          fullName: "Budi Santoso",
          position: "Kabag Marketing",
          department: "MKT",
          gender: Gender.MALE,
          birthDate: "1980-07-22",
          birthPlace: "Surabaya",
          startDate: "2008-05-16",
          isDeptHead: true,
          spouse: {
            fullName: "Wulan Sari",
            occupation: "Guru",
            birthPlace: "Surabaya",
            birthDate: "1982-10-03",
          },
          children: [
            { fullName: "Bagas Santoso", birthPlace: "Surabaya", birthDate: "2010-01-15" },
            { fullName: "Bella Santoso", birthPlace: "Surabaya", birthDate: "2013-08-09" },
          ],
          reports: [
            {
              fullName: "Riski Fitrah Aldiansyah",
              position: "Kasi Marketing Wilayah Utara",
              department: "MKT",
              gender: Gender.MALE,
              birthDate: "1995-06-12",
              birthPlace: "Surabaya",
              startDate: "2023-01-09",
              reports: [
                {
                  fullName: "Andika Pratama",
                  position: "Account Officer",
                  department: "MKT",
                  gender: Gender.MALE,
                  birthDate: "1998-03-21",
                  birthPlace: "Gresik",
                  startDate: "2024-06-03",
                },
              ],
            },
            {
              fullName: "Laily Hidayati",
              position: "Kasi Marketing Wilayah Selatan",
              department: "MKT",
              gender: Gender.FEMALE,
              birthDate: "1998-08-25",
              birthPlace: "Gresik",
              startDate: "2026-05-05",
              reports: [
                {
                  fullName: "Bayu Aji",
                  position: "Account Officer",
                  department: "MKT",
                  gender: Gender.MALE,
                  birthDate: "1997-11-11",
                  birthPlace: "Gresik",
                  startDate: "2023-09-18",
                },
              ],
            },
            {
              fullName: "Imroatuz Zuhriyah",
              position: "Kasi Marketing Pusat",
              department: "MKT",
              gender: Gender.FEMALE,
              birthDate: "1996-04-30",
              birthPlace: "Lamongan",
              startDate: "2024-02-19",
              reports: [
                {
                  fullName: "Sari Wulandari",
                  position: "Admin Marketing",
                  department: "MKT",
                  gender: Gender.FEMALE,
                  birthDate: "1999-01-09",
                  birthPlace: "Gresik",
                  startDate: "2025-01-20",
                },
                {
                  fullName: "Doni Kurniawan",
                  position: "Account Officer",
                  department: "MKT",
                  gender: Gender.MALE,
                  birthDate: "1997-07-07",
                  birthPlace: "Surabaya",
                  startDate: "2023-11-27",
                },
              ],
            },
            {
              fullName: "Siti Aminah",
              position: "Kasi Dana",
              department: "MKT",
              gender: Gender.FEMALE,
              birthDate: "1982-03-10",
              birthPlace: "Gresik",
              startDate: "2010-02-01",
              spouse: {
                fullName: "Hendra Kusuma",
                occupation: "Wiraswasta",
                birthPlace: "Gresik",
                birthDate: "1980-12-25",
              },
              reports: [
                {
                  fullName: "Haryogi",
                  position: "Funding Officer",
                  department: "MKT",
                  gender: Gender.MALE,
                  birthDate: "1988-12-01",
                  birthPlace: "Gresik",
                  startDate: "2014-07-14",
                },
              ],
            },
            {
              fullName: "Farid Ma'ruf",
              position: "Kasi Penagihan",
              department: "MKT",
              gender: Gender.MALE,
              birthDate: "1991-09-14",
              birthPlace: "Gresik",
              startDate: "2017-03-06",
              reports: [
                {
                  fullName: "Joko Susilo",
                  position: "Penagihan",
                  department: "MKT",
                  gender: Gender.MALE,
                  birthDate: "1994-05-19",
                  birthPlace: "Gresik",
                  startDate: "2020-10-12",
                },
              ],
            },
          ],
        },
        {
          fullName: "Dewi Kartika",
          position: "Kabag Personalia, Umum & IT",
          department: "PUI",
          gender: Gender.FEMALE,
          birthDate: "1985-11-05",
          birthPlace: "Lamongan",
          startDate: "2012-09-01",
          isDeptHead: true,
          reports: [
            {
              fullName: "Fahmi Ramadhan",
              position: "Kasi Personalia, Umum & IT",
              department: "PUI",
              gender: Gender.MALE,
              birthDate: "1983-09-18",
              birthPlace: "Gresik",
              startDate: "2011-04-11",
              reports: [
                {
                  fullName: "Retno Wulandari",
                  position: "Personalia",
                  department: "PUI",
                  gender: Gender.FEMALE,
                  birthDate: "1992-06-25",
                  birthPlace: "Gresik",
                  startDate: "2018-08-13",
                },
                {
                  fullName: "Anton Wijaya",
                  position: "Umum",
                  department: "PUI",
                  gender: Gender.MALE,
                  birthDate: "1990-02-17",
                  birthPlace: "Gresik",
                  startDate: "2016-05-09",
                },
                {
                  fullName: "Taufik Hidayat",
                  position: "EDP/IT",
                  department: "PUI",
                  gender: Gender.MALE,
                  birthDate: "1994-10-30",
                  birthPlace: "Surabaya",
                  startDate: "2020-11-16",
                },
                {
                  fullName: "Melati Putri",
                  position: "Digital Marketing",
                  department: "PUI",
                  gender: Gender.FEMALE,
                  birthDate: "1998-04-04",
                  birthPlace: "Gresik",
                  startDate: "2024-09-02",
                },
              ],
            },
          ],
        },
        {
          fullName: "Irwan Setiadi",
          position: "Kabag Legal",
          department: "LGL",
          gender: Gender.MALE,
          birthDate: "1981-01-27",
          birthPlace: "Gresik",
          startDate: "2010-04-19",
          isDeptHead: true,
          reports: [
            {
              fullName: "Nadia Ramadhani",
              position: "Legal Support",
              department: "LGL",
              workShift: "Shift Outsourcing Pagi",
              gender: Gender.FEMALE,
              birthDate: "1993-08-08",
              birthPlace: "Gresik",
              startDate: "2019-06-24",
            },
            {
              fullName: "Galih Prakoso",
              position: "Appraisal/SLIK",
              department: "LGL",
              workShift: "Shift Outsourcing Pagi",
              gender: Gender.MALE,
              birthDate: "1995-05-15",
              birthPlace: "Surabaya",
              startDate: "2021-10-04",
            },
          ],
        },
      ],
    },
  ],
}

const departmentDefs = [
  { code: "DIR", name: "Direksi" },
  { code: "AUD", name: "Audit Internal" },
  { code: "KEP", name: "Kepatuhan, Manajemen Risiko & APU PPT" },
  { code: "OPS", name: "Operasional" },
  { code: "LIT", name: "Penelitian & Pengembangan" },
  { code: "MKT", name: "Marketing" },
  { code: "PUI", name: "Personalia, Umum & IT" },
  { code: "LGL", name: "Legal" },
]

const workLocationDefs = [
  {
    name: KANTOR_PUSAT,
    address: "Jl. RA Kartini No. 1, Gresik, Jawa Timur",
    latitude: -7.1568,
    longitude: 112.6522,
  },
  {
    name: "Kas Bungah",
    address: "Jl. Raya Bungah No. 10, Kec. Bungah, Gresik, Jawa Timur",
    latitude: -7.0453,
    longitude: 112.6234,
  },
  {
    name: "Kas Menganti",
    address: "Jl. Raya Menganti No. 25, Kec. Menganti, Gresik, Jawa Timur",
    latitude: -7.3667,
    longitude: 112.5333,
  },
]

async function resetDummyData() {
  await prisma.employeeChild.deleteMany({})
  await prisma.employeeSpouse.deleteMany({})
  await prisma.user.deleteMany({ where: { employeeId: { not: null } } })
  await prisma.employee.deleteMany({})
  await prisma.department.deleteMany({})
  await prisma.position.deleteMany({})
  await prisma.workLocation.deleteMany({})
  await prisma.workShift.deleteMany({})
}

async function main() {
  await resetDummyData()

  const employeeRole = await prisma.role.upsert({
    where: { name: RoleName.EMPLOYEE },
    update: {},
    create: { name: RoleName.EMPLOYEE },
  })

  const employmentStatuses = ["Tetap", "Kontrak", "Percobaan", "Magang"]
  for (const name of employmentStatuses) {
    await prisma.employmentStatus.upsert({
      where: { name },
      update: {},
      create: { name },
    })
  }
  const tetapStatus = await prisma.employmentStatus.findUniqueOrThrow({
    where: { name: "Tetap" },
  })

  for (const location of workLocationDefs) {
    await prisma.workLocation.create({ data: location })
  }
  const workLocationByName = Object.fromEntries(
    (await prisma.workLocation.findMany()).map((w) => [w.name, w.id])
  )

  for (const dept of departmentDefs) {
    await prisma.department.create({ data: dept })
  }
  const departmentByCode = Object.fromEntries(
    (await prisma.department.findMany()).map((d) => [d.code, d.id])
  )

  const positionCache = new Map<string, number>()
  async function getPositionId(name: string) {
    const cached = positionCache.get(name)
    if (cached) return cached
    const position = await prisma.position.create({ data: { name } })
    positionCache.set(name, position.id)
    return position.id
  }

  const shiftsToCreate = [
    { name: "Shift Pagi", type: "PEGAWAI" as const, checkIn: "08:00", checkOut: "16:00" },
    { name: "Shift Siang", type: "PEGAWAI" as const, checkIn: "13:00", checkOut: "21:00" },
    { name: "Shift Outsourcing Pagi", type: "OUTSOURCING" as const, checkIn: "07:00", checkOut: "15:00" },
    { name: "Shift Outsourcing Malam", type: "OUTSOURCING" as const, checkIn: "15:00", checkOut: "23:00" },
  ]
  for (const shift of shiftsToCreate) {
    await prisma.workShift.create({
      data: {
        name: shift.name,
        type: shift.type,
        checkInTime: new Date(`1970-01-01T${shift.checkIn}:00.000Z`),
        checkOutTime: new Date(`1970-01-01T${shift.checkOut}:00.000Z`),
      },
    })
  }

  const workShiftByName = Object.fromEntries(
    (await prisma.workShift.findMany()).map((s) => [s.name, s.id])
  )

  // Contoh penyesuaian jam kerja untuk bulan Ramadan (dipakai nanti oleh
  // modul absensi). Jam masuk tetap, jam pulang dipercepat.
  await prisma.workShiftAdjustment.create({
    data: {
      workShiftId: workShiftByName["Shift Pagi"],
      name: "Ramadan 1447H",
      startDate: new Date("2026-02-18"),
      endDate: new Date("2026-03-19"),
      checkInTime: new Date("1970-01-01T08:00:00.000Z"),
      checkOutTime: new Date("1970-01-01T15:00:00.000Z"),
    },
  })

  let counter = 0
  let createdCount = 0

  async function processNode(node: OrgNode, reportsToId: number | null) {
    counter += 1
    const employeeNumber = `BG${String(counter).padStart(3, "0")}`
    const startDate = new Date(node.startDate)
    const birthDate = new Date(node.birthDate)
    const contractEndDate = computeContractEndDate(startDate, tetapStatus.name)
    const positionId = await getPositionId(node.position)
    const workLocationId = workLocationByName[node.workLocation ?? KANTOR_PUSAT]
    const workShiftId = workShiftByName[node.workShift ?? "Shift Pagi"]

    const employee = await prisma.employee.create({
      data: {
        employeeNumber,
        fullName: node.fullName,
        startDate,
        contractEndDate,
        departmentId: departmentByCode[node.department],
        positionId,
        workLocationId,
        employmentStatusId: tetapStatus.id,
        reportsToId,
        workShiftId,
        birthDate,
        birthPlace: node.birthPlace,
        gender: node.gender,
        maritalStatus: node.spouse ? MaritalStatus.MARRIED : MaritalStatus.SINGLE,
        nik: `35${node.birthDate.replace(/-/g, "")}${String(counter).padStart(3, "0")}`,
        address: `Jl. Contoh No. ${counter}, ${node.birthPlace}`,
        phone: `08${String(1000000000 + counter)}`,
        email: `${employeeNumber.toLowerCase()}@bankgresik.example.com`,
        lastEducation: "S1",
        major: "Umum",
        degree: node.gender === Gender.MALE ? "S.T." : "S.E.",
      },
    })
    createdCount += 1

    const passwordHash = await bcrypt.hash(initialPasswordFromBirthDate(birthDate), 10)
    await prisma.user.create({
      data: {
        username: employeeNumber,
        password: passwordHash,
        roleId: employeeRole.id,
        employeeId: employee.id,
        isActive: true,
      },
    })

    if (node.isDeptHead) {
      await prisma.department.update({
        where: { id: departmentByCode[node.department] },
        data: { headEmployeeId: employee.id },
      })
    }

    if (node.spouse) {
      await prisma.employeeSpouse.create({
        data: {
          employeeId: employee.id,
          fullName: node.spouse.fullName,
          occupation: node.spouse.occupation,
          birthPlace: node.spouse.birthPlace,
          birthDate: new Date(node.spouse.birthDate),
        },
      })
    }

    if (node.children?.length) {
      for (const child of node.children) {
        await prisma.employeeChild.create({
          data: {
            employeeId: employee.id,
            fullName: child.fullName,
            birthPlace: child.birthPlace,
            birthDate: new Date(child.birthDate),
          },
        })
      }
    }

    for (const report of node.reports ?? []) {
      await processNode(report, employee.id)
    }
  }

  await processNode(tree, null)

  console.log(
    `Seed dummy selesai: ${createdCount} pegawai sesuai struktur organisasi Bank Gresik (Direktur Utama ke bawah).`
  )
  console.log("Login pegawai: username = NIP (mis. BG001), password = tanggal lahir format YYYYMMDD.")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
