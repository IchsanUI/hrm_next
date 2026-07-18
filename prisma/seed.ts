import { PrismaClient, RoleName } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

async function main() {
  const superAdminRole = await prisma.role.upsert({
    where: { name: RoleName.SUPER_ADMIN },
    update: {},
    create: { name: RoleName.SUPER_ADMIN },
  })

  await prisma.role.upsert({
    where: { name: RoleName.HR_ADMIN },
    update: {},
    create: { name: RoleName.HR_ADMIN },
  })

  await prisma.role.upsert({
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

  const adminPasswordHash = await bcrypt.hash("admin123", 10)
  await prisma.user.upsert({
    where: { username: "admin" },
    update: {},
    create: {
      username: "admin",
      password: adminPasswordHash,
      roleId: superAdminRole.id,
      isActive: true,
    },
  })

  console.log("Seed selesai: Role, EmploymentStatus dasar, dan akun super admin (admin/admin123) siap.")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
