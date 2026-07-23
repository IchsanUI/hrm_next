-- AlterTable
ALTER TABLE `salary_components` ADD COLUMN `isBaseSalary` BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE `payroll_periods` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `year` INTEGER NOT NULL,
    `month` INTEGER NOT NULL,
    `periodStart` DATE NOT NULL,
    `periodEnd` DATE NOT NULL,
    `status` ENUM('DRAFT', 'LOCKED') NOT NULL DEFAULT 'DRAFT',
    `lockedAt` DATETIME(3) NULL,
    `lockedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `payroll_periods_year_month_key`(`year`, `month`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payslips` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `payrollPeriodId` INTEGER NOT NULL,
    `employeeId` INTEGER NOT NULL,
    `grossPay` DOUBLE NOT NULL,
    `totalDeduction` DOUBLE NOT NULL,
    `pph21` DOUBLE NOT NULL DEFAULT 0,
    `netPay` DOUBLE NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `payslips_payrollPeriodId_employeeId_key`(`payrollPeriodId`, `employeeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payslip_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `payslipId` INTEGER NOT NULL,
    `salaryComponentId` INTEGER NULL,
    `name` VARCHAR(191) NOT NULL,
    `category` ENUM('PENDAPATAN_TETAP', 'PENDAPATAN_TIDAK_TETAP', 'POTONGAN', 'PINJAMAN') NOT NULL,
    `amount` DOUBLE NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `payslips` ADD CONSTRAINT `payslips_payrollPeriodId_fkey` FOREIGN KEY (`payrollPeriodId`) REFERENCES `payroll_periods`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payslips` ADD CONSTRAINT `payslips_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `employees`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payslip_items` ADD CONSTRAINT `payslip_items_payslipId_fkey` FOREIGN KEY (`payslipId`) REFERENCES `payslips`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payslip_items` ADD CONSTRAINT `payslip_items_salaryComponentId_fkey` FOREIGN KEY (`salaryComponentId`) REFERENCES `salary_components`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
